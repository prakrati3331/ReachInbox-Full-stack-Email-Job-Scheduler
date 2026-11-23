import { Worker, Job, DelayedError, Queue } from "bullmq";
import { config } from "./config";
import { redis } from "./lib/redis";
import { prisma } from "./lib/prisma";
import { QUEUE_NAME, jobIdFor } from "./lib/queue";
import { sendEmail } from "./services/mailer";
import { checkHourlyLimit } from "./services/rateLimit";
import { notifyRateLimitHit } from "./services/slack";
import { indexEmail } from "./services/elasticsearch";

const QUEUE_OPTS = { connection: redis };

/** Re-add BullMQ jobs for DB rows that lost their Redis job (e.g. Redis flush). */
async function ensureJobFor(emailId: string, scheduledAt: Date) {
  const queue = new Queue(QUEUE_NAME, QUEUE_OPTS);
  try {
    const jobId = jobIdFor(emailId);
    const existing = await Job.fromId(queue, jobId);
    if (existing) {
      const state = await existing.getState();
      if (["completed", "failed"].includes(state)) {
        await existing.remove().catch(() => {});
      } else {
        return; // still tracked by BullMQ
      }
    }
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    await queue.add(
      "send-email",
      { emailId },
      {
        jobId,
        delay,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      }
    );
  } finally {
    await queue.close();
  }
}

/**
 * On boot: every DB row still in a "pending" state must have a live BullMQ job.
 * BullMQ delayed jobs already persist in Redis, so this only repairs rows whose
 * job vanished (Redis flush, manual removal, crash between DB insert and add).
 */
export async function reconcileScheduledEmails() {
  const pending = await prisma.scheduledEmail.findMany({
    where: { status: { in: ["scheduled", "rate_limited"] } },
    select: { id: true, scheduledAt: true, status: true },
  });
  for (const email of pending) {
    try {
      await ensureJobFor(email.id, email.scheduledAt);
    } catch (err) {
      console.error(`[reconcile] failed for ${email.id}:`, err);
    }
  }
  console.log(`[reconcile] checked ${pending.length} pending emails`);
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job<{ emailId: string }>, token?: string) => {
    const emailId = job.data.emailId;
    const email = await prisma.scheduledEmail.findUnique({ where: { id: emailId } });
    if (!email) return; // deleted

    // Idempotency: never send the same email twice.
    if (email.status === "sent") return;

    // --- Hourly rate limit (per sender/tenant, Redis-backed) ---
    const rl = await checkHourlyLimit(email.userId, email.hourlyLimit);
    if (!rl.allowed && rl.retryAt) {
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: "rate_limited", rateLimitedAt: new Date() },
      });
      await notifyRateLimitHit(email.userId); // no-op if Slack not connected
      await job.moveToDelayed(rl.retryAt, token);
      throw new DelayedError();
    }

    // --- Send ---
    await prisma.scheduledEmail.update({
      where: { id: email.id },
      data: { status: "sending", attempts: { increment: 1 } },
    });
    try {
      const result = await sendEmail({
        to: email.recipient,
        fromName: email.fromName,
        fromEmail: email.fromEmail,
        subject: email.subject,
        body: email.body,
      });
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: "sent", sentAt: new Date(), failReason: null },
      });
      console.log(`[worker] sent ${email.id} -> ${email.recipient} (${result.messageId})`);
      await indexEmail(email.id);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: "scheduled", failReason: reason },
      });
      throw err; // BullMQ retries with exponential backoff
    }
  },
  {
    connection: redis,
    concurrency: config.workerConcurrency,
    // BullMQ limiter => min spacing between job starts (provider-style throttle).
    limiter: { max: 1, duration: config.minDelayBetweenSendsMs },
  }
);

worker.on("failed", async (job, err) => {
  if (!job) return;
  if (err instanceof DelayedError || err.name === "DelayedError") return;
  const attempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < attempts) return; // will be retried
  const emailId = (job.data as { emailId?: string }).emailId;
  if (!emailId) return;
  await prisma.scheduledEmail
    .update({
      where: { id: emailId },
      data: { status: "failed", failReason: err.message },
    })
    .catch(() => {});
  await indexEmail(emailId);
});

worker.on("error", (err) => console.error("[worker] error:", err));

async function main() {
  await reconcileScheduledEmails();
  console.log(
    `[worker] started queue=${QUEUE_NAME} concurrency=${config.workerConcurrency} ` +
      `minDelay=${config.minDelayBetweenSendsMs}ms maxPerHour=${config.maxEmailsPerHourPerSender}`
  );
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});

const shutdown = async () => {
  await worker.close();
  await redis.quit();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
