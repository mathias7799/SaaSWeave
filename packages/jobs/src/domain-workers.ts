import { Worker, type ConnectionOptions, type Job } from "bullmq";

import { processBatchJob } from "@saasweave/app/batch-jobs/process";
import { ENV_SERVER } from "@saasweave/env/server/env";

import { runDataExportJob } from "#@/data-export-job";
import { resolveQueuePrefix } from "#@/queue-prefix";
import {
  QUEUE_NAMES,
  type BatchJobData,
  type DataExportJobData,
  type StripeWebhookJobData,
  type WebhookDeliveryJobData
} from "#@/queues";
import { processQueuedStripeWebhookJob } from "#@/stripe-webhook";
import { processQueuedWebhookDelivery } from "#@/webhook-dispatch";
import {
  attachWorkerLogging,
  closeNamedWorker,
  createWorkerConnection,
  workerConnections
} from "#@/worker-lifecycle";

function queueConcurrency(
  specific: number | undefined,
  fallback = ENV_SERVER.WORKER_CONCURRENCY
): number {
  return specific ?? fallback;
}

export async function processStripeWebhookJob(job: Job<StripeWebhookJobData>): Promise<void> {
  if (job.name !== "process") {
    throw new Error(`Unknown stripe job: ${job.name}`);
  }
  await processQueuedStripeWebhookJob(job.data);
}

export function createStripeWorker(): Worker {
  const connection = createWorkerConnection("worker:stripe");

  const worker = new Worker(QUEUE_NAMES.STRIPE, processStripeWebhookJob, {
    concurrency: 1,
    connection: connection as unknown as ConnectionOptions,
    prefix: resolveQueuePrefix()
  });

  workerConnections.set(worker, connection);
  attachWorkerLogging(worker);
  return worker;
}

export async function processDataExportQueueJob(job: Job<DataExportJobData>): Promise<void> {
  if (job.name !== "process") {
    throw new Error(`Unknown data export job: ${job.name}`);
  }
  await runDataExportJob(job.data.requestId);
}

export function createDataExportWorker(): Worker {
  const connection = createWorkerConnection("worker:data-export");

  const worker = new Worker(QUEUE_NAMES.DATA_EXPORT, processDataExportQueueJob, {
    concurrency: queueConcurrency(ENV_SERVER.WORKER_CONCURRENCY_DATA_EXPORT, 2),
    connection: connection as unknown as ConnectionOptions,
    prefix: resolveQueuePrefix()
  });

  workerConnections.set(worker, connection);
  attachWorkerLogging(worker);
  return worker;
}

export async function processBatchJobsQueueJob(job: Job<BatchJobData>): Promise<void> {
  if (job.name !== "process") {
    throw new Error(`Unknown batch job: ${job.name}`);
  }
  await processBatchJob(job.data.batchJobId);
}

export function createBatchJobsWorker(): Worker {
  const connection = createWorkerConnection("worker:batch-jobs");

  const worker = new Worker(QUEUE_NAMES.BATCH_JOBS, processBatchJobsQueueJob, {
    concurrency: queueConcurrency(ENV_SERVER.WORKER_CONCURRENCY_BATCH_JOBS, 3),
    connection: connection as unknown as ConnectionOptions,
    prefix: resolveQueuePrefix()
  });

  workerConnections.set(worker, connection);
  attachWorkerLogging(worker);
  return worker;
}

export async function processWebhookDeliveryJob(job: Job<WebhookDeliveryJobData>): Promise<void> {
  if (job.name !== "deliver") {
    throw new Error(`Unknown webhook job: ${job.name}`);
  }
  await processQueuedWebhookDelivery(job.data);
}

export function createWebhookWorker(): Worker {
  const connection = createWorkerConnection("worker:webhooks");

  const worker = new Worker(QUEUE_NAMES.WEBHOOKS, processWebhookDeliveryJob, {
    concurrency: queueConcurrency(ENV_SERVER.WORKER_CONCURRENCY_WEBHOOKS, 10),
    connection: connection as unknown as ConnectionOptions,
    prefix: resolveQueuePrefix()
  });

  workerConnections.set(worker, connection);
  attachWorkerLogging(worker);
  return worker;
}

export { closeNamedWorker };

export function createDomainWorkers(): Worker[] {
  return [
    createStripeWorker(),
    createDataExportWorker(),
    createBatchJobsWorker(),
    createWebhookWorker()
  ];
}
