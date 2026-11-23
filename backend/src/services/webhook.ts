import { prisma } from "../lib/prisma";

export type StatusEvent = "email.sent" | "email.failed";

export interface StatusPayload {
  emailId: string;
  recipient: string;
  subject: string;
  status: string;
  sentAt?: string | null;
  failReason?: string | null;
}

/** Fire the user's configured status webhook (no-op if unset). */
export async function fireStatusWebhook(
  userId: string,
  event: StatusEvent,
  payload: StatusPayload
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { webhookUrl: true },
  });
  if (!user?.webhookUrl) return;
  try {
    await fetch(user.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[webhook] delivery failed:", err);
  }
}
