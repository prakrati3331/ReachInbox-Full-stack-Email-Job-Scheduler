import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";

let transporterPromise: Promise<Transporter> | null = null;

async function createTransporter(): Promise<Transporter> {
  if (config.etherealUser && config.etherealPass) {
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
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
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

export function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) transporterPromise = createTransporter();
  return transporterPromise;
}

export interface SendEmailInput {
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}

export async function sendEmail(input: SendEmailInput) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: `"${input.fromName}" <${input.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.body,
    html: input.body
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join(""),
  });
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
}
