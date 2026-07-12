import { type Worker } from "bullmq";
import { type Redis } from "ioredis";

import { createRedisConnection } from "@saasweave/cache";
import { createLogger } from "@saasweave/logger/server";
import { jobDurationSeconds, jobRetriesTotal } from "@saasweave/observability";

const log = createLogger({ operation: "server__worker" });

export const workerConnections = new WeakMap<Worker, Redis>();

export function attachWorkerLogging(worker: Worker): void {
  worker.on("completed", (job) => {
    const startedAt = job.processedOn ?? job.timestamp;
    jobDurationSeconds.observe(
      { name: job.name, queue: job.queueName, status: "completed" },
      Math.max(0, Date.now() - startedAt) / 1000
    );
    log.info("Background job completed", {
      event: "job_completed",
      jobId: job.id,
      name: job.name,
      queue: job.queueName
    });
  });

  worker.on("failed", (job, error) => {
    if (job) {
      const startedAt = job.processedOn ?? job.timestamp;
      jobDurationSeconds.observe(
        { name: job.name, queue: job.queueName, status: "failed" },
        Math.max(0, Date.now() - startedAt) / 1000
      );
      if (job.attemptsMade > 0) {
        jobRetriesTotal.inc({ name: job.name, queue: job.queueName });
      }
    }
    log.error(error, {
      event: "job_failed",
      jobId: job?.id,
      name: job?.name,
      queue: job?.queueName
    });
  });
}

export function createWorkerConnection(name: string): Redis {
  const connection = createRedisConnection(name, {
    maxRetriesPerRequest: null
  });

  if (!connection) {
    throw new Error("Redis is required before workers can start. Set REDIS_URL.");
  }

  return connection;
}

export async function closeNamedWorker(worker: Worker): Promise<void> {
  await worker.close();
  const mapped = workerConnections.get(worker);
  if (mapped) {
    await mapped.quit();
    return;
  }

  const connection = worker.opts.connection as Redis | undefined;
  if (connection && typeof connection.quit === "function") {
    await connection.quit();
  }
}
