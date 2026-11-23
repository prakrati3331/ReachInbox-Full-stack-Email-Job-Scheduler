import { config } from "../config";
import { prisma } from "../lib/prisma";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_ACCESS_URL = "https://slack.com/api/oauth.v2.access";
const SLACK_API = "https://slack.com/api";

export function slackConfigured(): boolean {
  return Boolean(config.slack.clientId && config.slack.clientSecret);
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: "chat:write,channels:read,groups:read,im:write,mpim:write",
    redirect_uri: config.slack.redirectUri,
    state,
  });
  return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(SLACK_ACCESS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      code,
      redirect_uri: config.slack.redirectUri,
    }),
  });
  return (await res.json()) as {
    ok: boolean;
    access_token?: string;
    team?: { id?: string; name?: string };
    error?: string;
  };
}

export async function listChannels(accessToken: string) {
  const channels: { id: string; name: string }[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
    });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`${SLACK_API}/conversations.list?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as {
      ok: boolean;
      channels?: { id: string; name: string }[];
      response_metadata?: { next_cursor?: string };
    };
    if (!data.ok) break;
    channels.push(...(data.channels ?? []));
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return channels;
}

export async function postMessage(
  accessToken: string,
  channel: string,
  text: string
): Promise<boolean> {
  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) console.error("[slack] postMessage failed:", data.error);
    return data.ok;
  } catch (err) {
    console.error("[slack] postMessage error:", err);
    return false;
  }
}

/** Notify the user on Slack that their sender hit the hourly rate limit. */
export async function notifyRateLimitHit(userId: string): Promise<void> {
  const conn = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!conn) return; // not connected -> silently skip
  const channel = conn.channelId || config.slack.notifyChannelId;
  if (!channel) {
    console.warn("[slack] connected but no channel selected; skipping notify");
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  await postMessage(
    conn.accessToken,
    channel,
    `:warning: *ReachInbox rate limit reached* — ${user?.email ?? userId} hit their hourly email send limit. Jobs are being rescheduled into the next hour window.`
  );
}
