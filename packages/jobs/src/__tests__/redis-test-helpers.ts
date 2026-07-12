import Redis from "ioredis";
import { describe } from "vite-plus/test";

export const redisUrl = process.env.REDIS_URL;
export const describeRedis = redisUrl ? describe : describe.skip;

export function createFlushClient(): Redis {
  if (!redisUrl) {
    throw new Error("REDIS_URL is required for Redis integration tests.");
  }

  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export async function shutdownJobQueues(): Promise<void> {
  const { closeQueues, getQueue, QUEUE_NAMES } = await import("#@/queues");

  try {
    await getQueue(QUEUE_NAMES.EMAIL).getJobCounts("waiting");
  } catch {
    // Queue may already be closed from a prior teardown.
  }

  await closeQueues();
  await new Promise((resolve) => setTimeout(resolve, 100));
}
