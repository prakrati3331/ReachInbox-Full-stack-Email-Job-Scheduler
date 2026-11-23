# Demo Video Script (~5 min)

Record your screen at 1080p. Keep terminal + browser side by side where useful.

## 0:00 — Intro (15s)
> "This is ReachInbox's email job scheduler — a BullMQ + Redis + Postgres + Elasticsearch stack with a React dashboard. Emails are scheduled as persistent delayed jobs, sent through Ethereal SMTP, rate-limited per user per hour, and never lost on restart."

## 0:15 — Setup shot (20s)
Show terminals:
- `docker compose up -d` (Redis/Postgres/ES)
- `npm run dev` (API :4000) + `npm run worker`
- `npm run dev` (frontend :5173)

## 0:35 — Login + Compose (60s)
1. Open http://localhost:5173 → **dev login** (mention Google OAuth is implemented; needs real creds)
2. Click **+ Compose New Email**
3. Upload a CSV with ~10 emails → show detected count
4. Subject/body, start time = now+1min, delay 3s, hourly limit = 5
5. Hit **Schedule** → toast "Scheduled N emails"

## 1:35 — Watch it send (60s)
- Scheduled tab shows rows with staggered times
- Sent tab fills in live (5s polling)
- Open `http://localhost:4000/admin/queues` (admin/admin) → show delayed → active → completed jobs moving in real time
- Mention: min 2s delay + hourly limit enforced by BullMQ limiter + Redis counters

## 2:35 — Restart test (60s) ⭐ required
1. Compose another email scheduled ~2 min out
2. `Ctrl+C` the worker → show it's dead
3. Restart `npm run worker` → `[reconcile]` + `[worker] started`
4. Wait → email still sends exactly on time. Point out: jobs live in Redis, state in Postgres.

## 3:35 — Rate limit (45s)
1. Compose 10 emails, hourly limit = 3, start now
2. First 3 send; rest flip to `rate limited` and auto-reschedule to next hour
3. If Slack connected → show the Slack message; else mention it no-ops safely

## 4:20 — Extras quick tour (30s)
- Search box (Elasticsearch)
- Open/click badges (hit the tracking pixel)
- Dark mode 🌙 + language switcher (EN/ES/HI/KN)
- Cancel/delete a row, CSV export, stats/hourly bar in header

## 4:50 — Close (10s)
> "BullMQ delayed jobs for persistence, Redis counters for safe multi-worker rate limiting, Postgres as source of truth, Elasticsearch for search, real OAuth for auth — production patterns, zero cron."
