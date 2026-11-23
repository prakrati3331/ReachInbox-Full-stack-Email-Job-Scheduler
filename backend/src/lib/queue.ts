import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_NAME = "email-sends";

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export function jobIdFor(emailId: string): string {
  return `email-${emailId}`;
}
