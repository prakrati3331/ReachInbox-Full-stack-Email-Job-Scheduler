import "dotenv/config";

function num(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num("PORT", 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  apiPublicUrl: process.env.API_PUBLIC_URL ?? "http://localhost:4000",

  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  esIndex: process.env.ES_INDEX ?? "scheduled_emails",

  workerConcurrency: num("WORKER_CONCURRENCY", 10),
  minDelayBetweenSendsMs: num("MIN_DELAY_BETWEEN_SENDS_MS", 2000),
  maxEmailsPerHourPerSender: num("MAX_EMAILS_PER_HOUR_PER_SENDER", 100),

  etherealUser: process.env.ETHEREAL_USER ?? "",
  etherealPass: process.env.ETHEREAL_PASS ?? "",

  defaultFromName: process.env.DEFAULT_FROM_NAME ?? "Outbox Labs",
  defaultFromEmail: process.env.DEFAULT_FROM_EMAIL ?? "hello@outbox-labs.dev",

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ??
      "http://localhost:4000/api/auth/google/callback",
  },

  slack: {
    clientId: process.env.SLACK_CLIENT_ID ?? "",
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.SLACK_REDIRECT_URI ??
      "http://localhost:4000/api/slack/callback",
    notifyChannelId: process.env.SLACK_NOTIFY_CHANNEL_ID ?? "",
  },

  bullBoardUser: process.env.BULL_BOARD_USER ?? "admin",
  bullBoardPassword: process.env.BULL_BOARD_PASSWORD ?? "admin",

  sessionSecret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === "true",
};
