import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import {
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
} from "../lib/auth";

export const authRouter = Router();

const googleClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

function googleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

authRouter.get("/google", (_req, res) => {
  if (!googleConfigured()) {
    return res
      .status(503)
      .json({ error: "google_oauth_not_configured", hint: "Set GOOGLE_CLIENT_ID/SECRET" });
  }
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
  res.redirect(url);
});

authRouter.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || typeof code !== "string") {
      return res.redirect(`${config.frontendUrl}/?auth_error=missing_code`);
    }
    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token ?? "",
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return res.redirect(`${config.frontendUrl}/?auth_error=invalid_token`);
    }
    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture ?? null,
      },
      create: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
        avatarUrl: payload.picture ?? null,
      },
    });
    setSessionCookie(res, user.id);
    res.redirect(config.frontendUrl);
  } catch (err) {
    console.error("[auth] google callback failed:", err);
    res.redirect(`${config.frontendUrl}/?auth_error=oauth_failed`);
  }
});

// Dev-only login for local testing when Google OAuth isn't configured.
// Disabled unless ALLOW_DEV_LOGIN=true.
authRouter.post("/dev-login", async (req, res) => {
  if (!config.allowDevLogin) {
    return res.status(404).json({ error: "not_found" });
  }
  const { email, name } = req.body ?? {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "email_required" });
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: name ?? email },
    create: { email, name: name ?? email.split("@")[0] },
  });
  setSessionCookie(res, user.id);
  res.json({ user });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      slackConnection: {
        select: { teamName: true, channelId: true, connectedAt: true },
      },
    },
  });
  if (!user) return res.status(401).json({ error: "user_not_found" });
  res.json({ user });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
