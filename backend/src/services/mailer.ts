import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";
import { buildTrackedHtml } from "./tracking";

let transporterPromise: Promise<Transporter> | null = null;

async function createTransporter(): Promise<Transporter> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? (smtpHost ? 2525 : 465));
  const smtpSecure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : smtpPort === 465;

  if (smtpHost && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (config.etherealUser && config.etherealPass) {
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: smtpPort,
      secure: smtpSecure,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      auth: { user: config.etherealUser, pass: config.etherealPass },
    });
  }

  // No creds provided -> create a throwaway Ethereal test account at boot.
  const testAccount = await nodemailer.createTestAccount();
  console.log(
    `[mailer] Created Ethereal test account -> ${testAccount.user} / ${testAccount.pass}`
  );
  console.log(`[mailer] Ethereal web UI: https://ethereal.email`);
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: smtpPort,
    secure: smtpSecure,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

export function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) transporterPromise = createTransporter();
  return transporterPromise;
}

export interface SendAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  attachments?: SendAttachment[];
  trackingToken?: string | null;
}

export async function sendEmail(input: SendEmailInput) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: `"${input.fromName}" <${input.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.body,
    html: buildTrackedHtml(input.body, input.trackingToken ?? null),
    attachments: (input.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
}
