import { Router } from "express";
import { config } from "../config";
import { requireAuth, signOAuthState, verifyOAuthState } from "../lib/auth";
import { prisma } from "../lib/prisma";
import {
  slackConfigured,
  buildAuthorizeUrl,
  exchangeCode,
  listChannels,
} from "../services/slack";

export const slackRouter = Router();

slackRouter.get("/status", requireAuth, async (req, res) => {
  const conn = await prisma.slackConnection.findUnique({
    where: { userId: req.userId },
    select: { teamName: true, channelId: true, connectedAt: true },
  });
  res.json({ configured: slackConfigured(), connected: Boolean(conn), connection: conn });
});

slackRouter.get("/connect", requireAuth, (req, res) => {
  if (!slackConfigured()) {
    return res.status(503).json({ error: "slack_oauth_not_configured" });
  }
  res.redirect(buildAuthorizeUrl(signOAuthState(req.userId!)));
});

slackRouter.get("/callback", async (req, res) => {
  const userId = verifyOAuthState(req.query.state as string | undefined);
  const code = req.query.code as string | undefined;
  if (!userId || !code) {
    return res.redirect(`${config.frontendUrl}/?slack_error=invalid_state`);
  }
  try {
    const data = await exchangeCode(code);
    if (!data.ok || !data.access_token) {
      console.error("[slack] oauth exchange failed:", data.error);
      return res.redirect(`${config.frontendUrl}/?slack_error=exchange_failed`);
    }
    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        accessToken: data.access_token,
        teamId: data.team?.id ?? null,
        teamName: data.team?.name ?? null,
      },
      create: {
        userId,
        accessToken: data.access_token,
        teamId: data.team?.id ?? null,
        teamName: data.team?.name ?? null,
      },
    });
    res.redirect(`${config.frontendUrl}/?slack=connected`);
  } catch (err) {
    console.error("[slack] callback failed:", err);
    res.redirect(`${config.frontendUrl}/?slack_error=callback_failed`);
  }
});

slackRouter.get("/channels", requireAuth, async (req, res) => {
  const conn = await prisma.slackConnection.findUnique({
    where: { userId: req.userId },
  });
  if (!conn) return res.status(404).json({ error: "not_connected" });
  const channels = await listChannels(conn.accessToken);
  res.json({ channels, selected: conn.channelId });
});

slackRouter.post("/channel", requireAuth, async (req, res) => {
  const { channelId } = req.body ?? {};
  if (!channelId || typeof channelId !== "string") {
    return res.status(400).json({ error: "channelId_required" });
  }
  await prisma.slackConnection.update({
    where: { userId: req.userId },
    data: { channelId },
  });
  res.json({ ok: true });
});

slackRouter.post("/disconnect", requireAuth, async (req, res) => {
  await prisma.slackConnection.deleteMany({ where: { userId: req.userId } });
  res.json({ ok: true });
});
