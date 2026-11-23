import type {
  ListResponse,
  ParseLeadsResponse,
  ScheduledEmail,
  SearchResult,
  SlackChannel,
  SlackStatus,
  Template,
  User,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:logout"));
    throw new Error("unauthenticated");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<{ user: User }>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  setWebhook: (webhookUrl: string | null) =>
    request<{ webhookUrl: string | null }>("/auth/webhook", {
      method: "PUT",
      body: JSON.stringify({ webhookUrl }),
    }),

  templates: () => request<{ templates: Template[] }>("/templates"),
  createTemplate: (t: { name: string; subject: string; body: string }) =>
    request<{ template: Template }>("/templates", { method: "POST", body: JSON.stringify(t) }),
  deleteTemplate: (id: string) =>
    request<{ ok: boolean }>(`/templates/${id}`, { method: "DELETE" }),

  parseLeads: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<ParseLeadsResponse>("/emails/parse-leads", { method: "POST", body: fd });
  },

  schedule: (payload: {
    recipients: string[];
    subject: string;
    body: string;
    startAt: string;
    delayBetweenMs: number;
    hourlyLimit?: number;
    attachments?: { filename: string; contentType: string; dataBase64: string }[];
  }) =>
    request<{ scheduled: number }>("/emails/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  scheduled: (page = 1) => request<ListResponse>(`/emails/scheduled?page=${page}`),
  sent: (page = 1, status?: string) =>
    request<ListResponse>(`/emails/sent?page=${page}${status ? `&status=${status}` : ""}`),
  search: (q: string) => request<{ results: SearchResult[] }>(`/emails/search?q=${encodeURIComponent(q)}`),

  slackStatus: () => request<SlackStatus>("/slack/status"),
  slackChannels: () => request<{ channels: SlackChannel[]; selected: string | null }>("/slack/channels"),
  slackSetChannel: (channelId: string) =>
    request<{ ok: boolean }>("/slack/channel", { method: "POST", body: JSON.stringify({ channelId }) }),
  slackDisconnect: () => request<{ ok: boolean }>("/slack/disconnect", { method: "POST" }),

  stats: () =>
    request<{
      byStatus: Record<string, number>;
      sentLast24h: number;
      hourly: { used: number; limit: number; windowEndsAt: number };
    }>("/emails/stats"),

  deleteEmail: (id: string) =>
    request<{ ok: boolean }>(`/emails/${id}`, { method: "DELETE" }),
  deleteEmails: (ids: string[]) =>
    request<{ deleted: number }>("/emails/delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
};

export function googleLoginUrl(): string {
  return "/api/auth/google";
}

export type { ScheduledEmail };
