import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { prisma } from "./prisma";

const COOKIE = "outbox_session";
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function sign(value: string): string {
  return crypto.createHmac("sha256", config.sessionSecret).update(value).digest("hex");
}

export function createSessionCookie(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionUserId(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const [payload, sig] = cookieValue.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.uid || data.exp < Date.now()) return null;
    return data.uid as string;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: string) {
  res.cookie(COOKIE, createSessionCookie(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    maxAge: MAX_AGE_MS,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE);
}

export function signOAuthState(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, nonce: crypto.randomBytes(8).toString("hex") })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyOAuthState(state: string | undefined): string | null {
  if (!state) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (data.uid as string) ?? null;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const uid = readSessionUserId(req.cookies?.[COOKIE]);
  if (!uid) return res.status(401).json({ error: "unauthenticated" });
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) return res.status(401).json({ error: "user_not_found" });
  req.userId = uid;
  next();
}
