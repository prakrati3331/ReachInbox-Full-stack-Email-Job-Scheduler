import "express-async-errors";
import express from "express";
import { existsSync } from "fs";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { config } from "./config";
import { prisma } from "./lib/prisma";
import { emailQueue } from "./lib/queue";
import { redisPing } from "./lib/redis";
import { authRouter } from "./routes/auth";
import { emailsRouter } from "./routes/emails";
import { slackRouter } from "./routes/slack";
import { templatesRouter } from "./routes/templates";
import { trackRouter } from "./routes/track";
import { ensureIndex } from "./services/elasticsearch";
import { getTransporter } from "./services/mailer";

const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "25mb" }));
app.use(cookieParser());

// --- Bull Board (live queue dashboard) ---
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});
const boardAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const header = req.headers.authorization ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = Buffer.from(encoded, "base64").toString().split(":");
    if (user === config.bullBoardUser && pass === config.bullBoardPassword) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="bull-board"');
  res.status(401).send("Authentication required");
};
app.use("/admin/queues", boardAuth, serverAdapter.getRouter());

// --- API routes ---
app.get("/api/health", async (_req, res) => {
  const [db, redisOk] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    redisPing(),
  ]);
  res.json({ ok: db && redisOk, db, redis: redisOk });
});
app.use("/api/auth", authRouter);
app.use("/api/emails", emailsRouter);
app.use("/api/slack", slackRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/track", trackRouter);

// Serve the built frontend (single-origin deploy) when present.
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/admin")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] error:", err);
  res.status(500).json({ error: "internal_error" });
});

async function main() {
  await ensureIndex().catch((e) => console.error("[es] ensureIndex failed:", e));
  await getTransporter().catch((e) => console.error("[mailer] init failed:", e));
  app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
    console.log(`[api] bull board: http://localhost:${config.port}/admin/queues`);
  });
}

main().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});
