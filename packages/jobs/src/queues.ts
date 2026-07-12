import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { type Redis } from "ioredis";

import { createRedisConnection, isRedisEnabled } from "@saasweave/cache";
import { type WebhookPayload } from "@saasweave/core/webhooks";
import { type NotificationInput } from "@saasweave/db";

import { resolveQueuePrefix } from "#@/queue-prefix";

export const QUEUE_NAMES = {
  BATCH_JOBS: "batch-jobs",
  DATA_EXPORT: "data-export",
  EMAIL: "email",
  NOTIFICATIONS: "notifications",
  SCHEDULES: "schedules",
  STRIPE: "stripe",
  WEBHOOKS: "webhooks"
} as const;

export const SCHEDULE_JOB_NAMES = {
  CLEANUP_STORAGE: "cleanup-storage",
  DATA_RETENTION: "data-retention",
  EXPIRE_INVITATIONS: "expire-invitations",
  REFRESH_PLATFORM_ANALYTICS: "refresh-platform-analytics",
  SNAPSHOT_MRR: "snapshot-mrr"
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type SendTemplateEmailJobData = {
  key: string;
  meta?: {
    organizationId?: string | null;
  };
  to: string;
  values?: Record<string, string>;
};

export type CreateNotificationJobData = NotificationInput;

export type StripeWebhookJobData = {
  eventId: string;
  type: string;
  payload: string;
};

export type WebhookDeliveryJobData = {
  endpointId: string;
  payload: WebhookPayload;
  url: string;
};

export type ScheduleJobData = Record<string, never>;

export type DataExportJobData = {
  requestId: string;
};

export type BatchJobData = {
  batchJobId: string;
};

export type AppJobData =
  | SendTemplateEmailJobData
  | CreateNotificationJobData
  | StripeWebhookJobData
  | WebhookDeliveryJobData
  | ScheduleJobData
  | DataExportJobData
  | BatchJobData;

const queues = new Map<QueueName, Queue>();
let producerConnection: Redis | null = null;

export const QUEUE_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    delay: 2_000,
    type: "exponential"
  },
  removeOnComplete: 1_000,
  removeOnFail: 5_000
} satisfies JobsOptions;

function getProducerConnection(): Redis {
  if (!isRedisEnabled()) {
    throw new Error("Redis is required before queues can be used. Set REDIS_URL.");
  }

  if (!producerConnection) {
    const connection = createRedisConnection("queue:producers", {
      maxRetriesPerRequest: null
    });

    if (!connection) {
      throw new Error("Redis is required before queues can be used. Set REDIS_URL.");
    }

    producerConnection = connection;
  }

  return producerConnection;
}

function createQueue(name: QueueName): Queue {
  const connection = getProducerConnection();

  return new Queue(name, {
    connection: connection as unknown as ConnectionOptions,
    defaultJobOptions: QUEUE_DEFAULT_JOB_OPTIONS,
    prefix: resolveQueuePrefix()
  });
}

export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = createQueue(name);
  queues.set(name, queue);
  return queue;
}

export async function enqueueTemplateEmail(
  data: SendTemplateEmailJobData,
  options: JobsOptions = {}
) {
  return getQueue(QUEUE_NAMES.EMAIL).add("send-template", data, options);
}

export async function enqueueNotification(
  data: CreateNotificationJobData,
  options: JobsOptions = {}
) {
  return getQueue(QUEUE_NAMES.NOTIFICATIONS).add("create", data, options);
}

export async function enqueueStripeWebhook(data: StripeWebhookJobData, options: JobsOptions = {}) {
  return getQueue(QUEUE_NAMES.STRIPE).add("process", data, {
    jobId: `stripe:${data.eventId}`,
    ...options
  });
}

export async function enqueueWebhookDelivery(
  data: WebhookDeliveryJobData,
  options: JobsOptions = {}
) {
  return getQueue(QUEUE_NAMES.WEBHOOKS).add("deliver", data, options);
}

export async function enqueueDataExport(data: DataExportJobData, options: JobsOptions = {}) {
  return getQueue(QUEUE_NAMES.DATA_EXPORT).add("process", data, {
    jobId: `data-export:${data.requestId}`,
    ...options
  });
}

export async function enqueueBatchJob(data: BatchJobData, options: JobsOptions = {}) {
  return getQueue(QUEUE_NAMES.BATCH_JOBS).add("process", data, {
    jobId: `batch-job:${data.batchJobId}`,
    ...options
  });
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();

  const connection = producerConnection;
  producerConnection = null;
  if (connection) {
    await connection.quit();
  }
}

const FAILED_JOBS_DEGRADED_THRESHOLD = 100;

export async function checkQueueReady() {
  if (!isRedisEnabled()) {
    return { configured: false, status: "healthy" as const };
  }

  try {
    const queueNames = Object.values(QUEUE_NAMES);
    const counts = await Promise.all(
      queueNames.map(async (name) => {
        const jobCounts = await getQueue(name).getJobCounts("waiting", "delayed", "failed");
        return {
          failed: jobCounts.failed ?? 0,
          pending: (jobCounts.waiting ?? 0) + (jobCounts.delayed ?? 0)
        };
      })
    );

    const failed = counts.reduce((sum, entry) => sum + entry.failed, 0);
    const pending = counts.reduce((sum, entry) => sum + entry.pending, 0);
    const degraded = counts.some((entry) => entry.failed > FAILED_JOBS_DEGRADED_THRESHOLD);

    return {
      configured: true,
      failed,
      pending,
      status: degraded ? ("degraded" as const) : ("healthy" as const)
    };
  } catch {
    return { configured: true, status: "unhealthy" as const };
  }
}
