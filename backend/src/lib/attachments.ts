import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface IncomingAttachment {
  filename: string;
  contentType: string;
  dataBase64: string;
}

/** Shape stored in ScheduledEmail.attachments (JSON column). */
export interface StoredAttachment {
  filename: string;
  contentType: string;
  /** path relative to backend root, e.g. "uploads/<hash>" */
  path: string;
  size: number;
}

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // decoded, total

const BACKEND_ROOT = path.resolve(__dirname, "../..");
const UPLOAD_DIR = path.join(BACKEND_ROOT, "uploads");

/**
 * Validate + persist attachment payloads to disk once per schedule request.
 * Returns null when the payload is invalid or over limits.
 */
export function saveAttachments(raw: unknown): StoredAttachment[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) return null;

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const stored: StoredAttachment[] = [];
  let total = 0;

  for (const a of raw as IncomingAttachment[]) {
    if (
      typeof a?.filename !== "string" ||
      typeof a?.contentType !== "string" ||
      typeof a?.dataBase64 !== "string"
    ) {
      return null;
    }
    const buf = Buffer.from(a.dataBase64, "base64");
    total += buf.length;
    if (total > MAX_ATTACHMENT_BYTES) return null;

    const safeName = path.basename(a.filename).slice(0, 200) || "attachment";
    const rel = `uploads/${crypto.randomBytes(16).toString("hex")}`;
    fs.writeFileSync(path.join(BACKEND_ROOT, rel), buf);
    stored.push({
      filename: safeName,
      contentType: a.contentType.slice(0, 100) || "application/octet-stream",
      path: rel,
      size: buf.length,
    });
  }
  return stored;
}

export function attachmentBuffer(a: StoredAttachment): Buffer | null {
  try {
    return fs.readFileSync(path.join(BACKEND_ROOT, a.path));
  } catch {
    return null;
  }
}
