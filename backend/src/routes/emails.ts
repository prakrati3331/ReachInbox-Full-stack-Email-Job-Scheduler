import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { emailQueue, jobIdFor } from "../lib/queue";
import { indexEmail, searchEmails } from "../services/elasticsearch";
import { config } from "../config";
import { saveAttachments, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES } from "../lib/attachments";

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Parse uploaded CSV/TXT lead file -> deduped email addresses.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

emailsRouter.post("/parse-leads", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file_required" });
  const text = req.file.buffer.toString("utf8");
  const matches = text.match(EMAIL_RE) ?? [];
  const unique = [...new Set(matches.map((m) => m.toLowerCase()))];
  res.json({ count: unique.length, emails: unique.slice(0, 5000) });
});

interface ScheduleBody {
  recipients?: string[];
  subject?: string;
  body?: string;
  startAt?: string;
  delayBetweenMs?: number;
  hourlyLimit?: number;
  fromName?: string;
  fromEmail?: string;
  attachments?: unknown;
}

emailsRouter.post("/schedule", async (req, res) => {
  const b = req.body as ScheduleBody;
  const recipients = [...new Set((b.recipients ?? []).map((e) => e.trim().toLowerCase()))].filter(Boolean);
  if (recipients.length === 0) return res.status(400).json({ error: "recipients_required" });
  if (recipients.length > 5000) return res.status(400).json({ error: "too_many_recipients", max: 5000 });
  if (!b.subject?.trim() || !b.body?.trim()) {
    return res.status(400).json({ error: "subject_and_body_required" });
  }

  const startAt = b.startAt ? new Date(b.startAt) : new Date();
  if (Number.isNaN(startAt.getTime())) return res.status(400).json({ error: "invalid_startAt" });
  const effectiveStart = startAt.getTime() < Date.now() ? new Date() : startAt;

  const delayBetweenMs = Math.max(0, Math.min(b.delayBetweenMs ?? 0, 60 * 60 * 1000));
  const hourlyLimit =
    b.hourlyLimit && b.hourlyLimit > 0
      ? Math.min(Math.floor(b.hourlyLimit), 100000)
      : null;

  const fromName = b.fromName?.trim() || config.defaultFromName;
  const fromEmail = b.fromEmail?.trim() || config.defaultFromEmail;

  const attachments = saveAttachments(b.attachments);
  if (attachments === null) {
    return res.status(400).json({ error: "invalid_attachments", maxFiles: MAX_ATTACHMENTS, maxBytes: MAX_ATTACHMENT_BYTES });
  }

  const created = [];
  for (let i = 0; i < recipients.length; i++) {
    const scheduledAt = new Date(effectiveStart.getTime() + i * delayBetweenMs);
    const email = await prisma.scheduledEmail.create({
      data: {
        userId: req.userId!,
        recipient: recipients[i],
        fromName,
        fromEmail,
        subject: b.subject.trim(),
        body: b.body,
        scheduledAt,
        hourlyLimit: hourlyLimit ?? config.maxEmailsPerHourPerSender,
        attachments: attachments.length
          ? (attachments as unknown as Prisma.InputJsonValue)
          : undefined,
        trackingToken: crypto.randomBytes(16).toString("hex"),
      },
    });
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    await emailQueue.add(
      "send-email",
      { emailId: email.id },
      {
        jobId: jobIdFor(email.id),
        delay,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
      }
    );
    await prisma.scheduledEmail.update({
      where: { id: email.id },
      data: { bullJobId: jobIdFor(email.id) },
    });
    void indexEmail(email.id);
    created.push(email.id);
  }

  res.status(201).json({ scheduled: created.length });
});

emailsRouter.get("/scheduled", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const where = {
    userId: req.userId!,
    status: { in: ["scheduled", "rate_limited", "sending"] },
  };
  const [total, emails] = await Promise.all([
    prisma.scheduledEmail.count({ where }),
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  res.json({ total, page, emails });
});

emailsRouter.get("/sent", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const status = req.query.status === "failed" ? "failed" : "sent";
  const where = { userId: req.userId!, status };
  const [total, emails] = await Promise.all([
    prisma.scheduledEmail.count({ where }),
    prisma.scheduledEmail.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  res.json({ total, page, emails });
});

emailsRouter.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "");
  const results = await searchEmails(req.userId!, q);
  res.json({ results });
});
