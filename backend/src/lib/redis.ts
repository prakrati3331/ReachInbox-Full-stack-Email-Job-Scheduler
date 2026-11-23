import Redis from "ioredis";
import { config } from "../config";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ
});

// Separate connection for BullMQ blocking commands is created inside the Worker.
export async function redisPing(): Promise<boolean> {
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}
