# Outbox — Email Job Scheduler & Dashboard

A production-grade email scheduling service: accept send requests via API, schedule them with **BullMQ delayed jobs on Redis**, persist everything in **PostgreSQL**, send through **Ethereal Email (fake SMTP)**, index emails in **Elasticsearch** for search, and serve a **React dashboard** with Google login, compose, scheduled/sent views and Slack rate-limit alerts.

## Architecture

```
React dashboard ──► Express API ──► PostgreSQL (Prisma)
                        │
                        ├── BullMQ Queue "email-sends" ──► Redis (delayed jobs)
                        │                                    │
                        │                              BullMQ Worker
                        │                              (concurrency + limiter)
                        │                                    │
                        │              ┌─────────────────────┼──────────────────┐
                        │              ▼                     ▼                  ▼
                        │        Ethereal SMTP        Redis hourly      Elasticsearch
                        │        (nodemailer)          counters          (search index)
                        │                                             Slack notify
                        └── Bull Board at /admin/queues (live queue UI)
```

- **Scheduling**: `POST /api/emails/schedule` creates one DB row per recipient and one BullMQ delayed job per row (`jobId = email:<id>`). No cron anywhere — timing lives entirely in Redis delayed sets, so it survives restarts.
- **Persistence on restart**: BullMQ jobs are stored in Redis, so delayed jobs survive API/worker restarts automatically. On worker boot, `reconcileScheduledEmails()` scans DB rows still in `scheduled`/`rate_limited` state and re-creates any job that is missing (e.g. after a Redis flush), so nothing is lost or restarted from day one. The processor also checks DB status first, so a job can never send an email twice (idempotency).
- **Rate limiting**: two layers.
  1. *Min delay between sends* — BullMQ worker `limiter: { max: 1, duration: MIN_DELAY_BETWEEN_SENDS_MS }` (default 2s between job starts, i.e. provider-style throttling).
  2. *Emails per hour* — Redis counter `hourly:<userId>:<hourWindow>` incremented atomically (`INCR`+`EXPIRE`) inside the worker, safe across multiple worker instances. Limit = the batch's `hourlyLimit`, falling back to `MAX_EMAILS_PER_HOUR_PER_SENDER`. When the window is full the job is **not failed** — it calls `job.moveToDelayed(nextHourStart)` and throws `DelayedError`, so BullMQ re-queues it for the next hour window automatically. The instant a limit is hit we also POST to the user's connected Slack channel.
- **Concurrency**: `WORKER_CONCURRENCY` controls parallel job processing; combined with the limiter, sends are spaced by the configured delay.
- **Search**: every email is indexed into Elasticsearch on create and on every status change; `GET /api/emails/search?q=` powers the dashboard search box.
- **Auth**: real Google OAuth2 (authorization-code flow) issues an HMAC-signed httpOnly session cookie. Slack uses the real OAuth v2 flow (`chat:write` + channel read scopes) and stores the bot token per user.

## Repo layout

```
backend/    Express + TypeScript API, BullMQ worker, Prisma, services
frontend/   Vite + React + TypeScript + Tailwind dashboard
docker-compose.yml   Redis + Postgres + Elasticsearch
```

## Quick start

### 1. Infra

```bash
docker compose up -d     # redis:6379, postgres:5432, elasticsearch:9200
```

### 2. Backend

```bash
cd backend
cp .env.example .env     # fill in values (see below)
npm install
npx prisma migrate dev   # creates tables
npm run dev              # API on :4000
# second terminal:
npm run worker           # BullMQ worker
```

Bull Board live queue UI: `http://localhost:4000/admin/queues` (basic auth `BULL_BOARD_USER`/`BULL_BOARD_PASSWORD`).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173 (proxies /api -> :4000)
```

### 4. Env vars (backend/.env)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `REDIS_URL` | BullMQ / rate-limit counters |
| `ELASTICSEARCH_URL`, `ES_INDEX` | Search backend |
| `WORKER_CONCURRENCY` | Parallel job processing (default 10) |
| `MIN_DELAY_BETWEEN_SENDS_MS` | Min spacing between sends — we chose **2000 ms** |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Global fallback hourly cap (default 100) |
| `ETHEREAL_USER` / `ETHEREAL_PASS` | SMTP creds from https://ethereal.email — if empty, a throwaway Ethereal account is created at boot and creds printed to the worker log |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google OAuth — redirect URI must be `<API>/api/auth/google/callback` |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_REDIRECT_URI` / `SLACK_NOTIFY_CHANNEL_ID` | Slack OAuth v2 — needs `chat:write`, `channels:read`, `groups:read`, `im:write`, `mpim:write` bot scopes |
| `ALLOW_DEV_LOGIN` | `true` enables a dev-only email login on the sign-in page (local testing without Google creds) |

## Features

**Backend**
- Schedule emails via API (`POST /api/emails/schedule`, bulk recipients, per-recipient staggered `scheduledAt`)
- BullMQ delayed-job scheduling — no cron; survives restarts (Redis persistence + boot reconciliation)
- Idempotent sends (jobId dedupe + DB status guard)
- Worker concurrency + BullMQ limiter for min inter-send delay
- Redis-backed per-sender hourly rate limit; overflow auto-rescheduled to next hour window
- Slack OAuth + live `chat.postMessage` notification on rate-limit hit (no-op when not connected)
- Elasticsearch indexing & search API
- Bull Board queue dashboard
- Ethereal SMTP sending via nodemailer (auto test account if no creds)
- **Email templates** — per-user reusable subject/body (`/api/templates` CRUD, picker + "save as template" in compose)
- **Attachments** — up to 5 files / 8 MB total per email, stored under `backend/uploads/` and attached via nodemailer
- **Open/click tracking** — every email gets a per-recipient tracking token; HTML includes a 1×1 open pixel (`/api/track/o/:token.gif`) and links are rewritten through `/api/track/c/:token?u=…` redirects. `openedAt`/`clickedAt` are recorded on the email and shown in the dashboard
- **Status webhooks** — users can set a webhook URL (`PUT /api/auth/webhook` or the compose modal); the backend POSTs `{event: "email.sent"|"email.failed", …}` JSON on terminal status changes

**Frontend**
- Real Google OAuth login, header with name/email/avatar, logout
- Scheduled / Sent tabs with loading + empty states, live polling
- Compose modal: template picker + save-as-template, CSV/TXT lead upload with detected-count, attachments (max 5 / 8 MB), subject, body, start time, delay, hourly limit, status webhook URL
- Open/click badges on sent emails; attachments stored in `backend/uploads/` (gitignored)
- Elasticsearch-backed search across emails
- Slack connect/disconnect + notification channel picker

## Assumptions & trade-offs

- **Rate-limit keying**: counters are per *user* (tenant); each compose batch can carry its own `hourlyLimit`, and the shared counter is conservative when batches differ.
- **Ordering**: jobs delayed into the next hour window keep approximate FIFO order; exact ordering under limit overflow is best-effort.
- **Duplicate-send window**: a crash between SMTP success and the DB `sent` update could resend once; the window is sub-second and BullMQ stalled-job recovery covers worker crashes.
- **Ethereal `from` address**: Ethereal accepts arbitrary `From` headers in practice; for real SMTP you'd verify sender domains.
- **Dev login**: `ALLOW_DEV_LOGIN=true` exists only for local demos without Google OAuth configured; it is disabled by default.
- **Search scope**: ES queries are filtered to the logged-in user.
