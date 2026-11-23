import { Router } from "express";
import { prisma } from "../lib/prisma";
import { OPEN_PIXEL } from "../services/tracking";

// Public tracking endpoints — no auth (they are hit by the recipient's mail client).
export const trackRouter = Router();

trackRouter.get("/o/:token.gif", async (req, res) => {
  const { token } = req.params;
  const email = await prisma.scheduledEmail.findUnique({ where: { trackingToken: token } });
  if (email && !email.openedAt) {
    await prisma.scheduledEmail.update({
      where: { id: email.id },
      data: { openedAt: new Date() },
    });
  }
  res.set("Content-Type", "image/gif");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.send(OPEN_PIXEL);
});

trackRouter.get("/c/:token", async (req, res) => {
  const { token } = req.params;
  const to = typeof req.query.u === "string" ? req.query.u : "";
  let target: URL | null = null;
  try {
    const u = new URL(to);
    if (u.protocol === "http:" || u.protocol === "https:") target = u;
  } catch {
    /* invalid */
  }
  if (!target) return res.status(400).send("invalid redirect target");

  const email = await prisma.scheduledEmail.findUnique({ where: { trackingToken: token } });
  if (email) {
    await prisma.scheduledEmail.update({
      where: { id: email.id },
      data: { clickedAt: new Date() },
    });
  }
  res.redirect(302, target.toString());
});
