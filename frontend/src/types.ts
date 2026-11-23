export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  webhookUrl?: string | null;
  slackConnection?: {
    teamName: string | null;
    channelId: string | null;
    connectedAt: string;
  } | null;
}

export type EmailStatus =
  | "scheduled"
  | "rate_limited"
  | "sending"
  | "sent"
  | "failed";

export interface ScheduledEmail {
  id: string;
  recipient: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  failReason: string | null;
  hourlyLimit: number;
  openedAt?: string | null;
  clickedAt?: string | null;
  createdAt: string;
}

export interface SentEmail extends ScheduledEmail {}

export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

export interface SlackStatus {
  configured: boolean;
  connected: boolean;
  connection: {
    teamName: string | null;
    channelId: string | null;
    connectedAt: string;
  } | null;
}

export interface SlackChannel {
  id: string;
  name: string;
}

export interface SearchResult {
  emailId: string;
  userId: string;
  recipient: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

export interface ListResponse {
  total: number;
  page: number;
  emails: ScheduledEmail[];
}

export interface ParseLeadsResponse {
  count: number;
  emails: string[];
}
