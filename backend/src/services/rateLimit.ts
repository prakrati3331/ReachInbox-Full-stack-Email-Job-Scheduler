import { redis } from "../lib/redis";
import { config } from "../config";

const HOUR_MS = 60 * 60 * 1000;

export function hourWindowStart(ts: number): number {
  return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  used: number;
  /** epoch ms when the current window ends (next available slot) */
  retryAt?: number;
}

/**
 * Redis-backed per-user (sender/tenant) hourly counter.
 * Safe across multiple worker instances because INCR/EXPIRE are atomic.
 */
export async function checkHourlyLimit(
  userId: string,
  perEmailLimit?: number | null
): Promise<RateLimitResult> {
  const limit = perEmailLimit ?? config.maxEmailsPerHourPerSender;
  const window = hourWindowStart(Date.now());
  const key = `hourly:${userId}:${window}`;

  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, Math.ceil((window + HOUR_MS - Date.now()) / 1000) + 60);

  if (count <= limit) {
    return { allowed: true, limit, used: count };
  }

  // Over the limit: roll back this reservation and report the next window.
  await redis.decr(key);
  return { allowed: false, limit, used: limit, retryAt: window + HOUR_MS };
}
