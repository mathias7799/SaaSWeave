import { Worker, type ConnectionOptions, type Job } from "bullmq";

import { createNotifications } from "@saasweave/db";
import { ENV_SERVER } from "@saasweave/env/server/env";

import {
  createBatchJobsWorker,
  createDataExportWorker,
  createDomainWorkers,
  createStripeWorker,
  createWebhookWorker,
  processBatchJobsQueueJob,
  processDataExportQueueJob,
  processStripeWebhookJob,
  processWebhookDeliveryJob
} from "#@/domain-workers";
import { resolveQueuePrefix } from "#@/queue-prefix";
import {
  QUEUE_NAMES,
  type CreateNotificationJobData,
  type SendTemplateEmailJobData
} from "#@/queues";
import { createScheduleWorker, processScheduleJob } from "#@/schedule-worker";
import { runTemplateEmail } from "#@/template-email";
import {
  attachWorkerLogging,
  closeNamedWorker,
  createWorkerConnection,
  workerConnections
} from "#@/worker-lifecycle";

export function createEmailWorker(): Worker {
  const connection = createWorkerConnection("worker:email");

  const worker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job: Job<SendTemplateEmailJobData>) => {
      if (job.name !== "send-template") {
        throw new Error(`Unknown email job: ${job.name}`);
      }

      await runTemplateEmail(job.data.key, job.data.to, job.data.values ?? {}, job.data.meta ?? {});
    },
    {
      concurrency: ENV_SERVER.WORKER_CONCURRENCY,
      connection: connection as unknown as ConnectionOptions,
      prefix: resolveQueuePrefix()
    }
  );

  workerConnections.set(worker, connection);
  attachWorkerLogging(worker);

  return worker;
}

export function createNotificationWorker(): Worker {
  const connection = createWorkerConnection("worker:notifications");

  const worker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job: Job<CreateNotificationJobData>) => {
      if (job.name !== "create") {
        throw new Error(`Unknown notification job: ${job.name}`);
      }

      await createNotifications(job.data);
    },
    {
      concurrency: ENV_SERVER.WORKER_CONCURRENCY,
      connection: connection as unknown as ConnectionOptions,
      prefix: resolveQueuePrefix()
    }
  );

  workerConnections.set(worker, connection);
  attachWorkerLogging(worker);

  return worker;
}

export function createWorkers(): Worker[] {
  return [createEmailWorker(), createNotificationWorker()];
}

export {
  closeNamedWorker,
  createBatchJobsWorker,
  createDataExportWorker,
  createDomainWorkers,
  createStripeWorker,
  createWebhookWorker,
  processBatchJobsQueueJob,
  processDataExportQueueJob,
  processStripeWebhookJob,
  processWebhookDeliveryJob
};

export { createScheduleWorker, processScheduleJob };

export function createAllWorkers(): Worker[] {
  return [...createWorkers(), ...createDomainWorkers(), createScheduleWorker()];
}

export async function closeAllWorkers(workers: Worker[]): Promise<void> {
  const coreCount = 2;
  const coreWorkers = workers.slice(0, coreCount);
  const remaining = workers.slice(coreCount);

  await closeWorkers(coreWorkers);
  await Promise.all(remaining.map((worker) => closeNamedWorker(worker)));
}

export async function closeWorkers(workers: Worker[]): Promise<void> {
  await Promise.all(
    workers.map(async (worker) => {
      await worker.close();
      await workerConnections.get(worker)?.quit();
    })
  );
}
