import { type Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  QUEUE_NAMES,
  type BatchJobData,
  type DataExportJobData,
  type StripeWebhookJobData,
  type WebhookDeliveryJobData
} from "#@/queues";

const processQueuedStripeWebhookJob = vi.fn();
const processBatchJobMock = vi.fn(async (_batchJobId: string) => undefined);
const runDataExportJob = vi.fn();
const processQueuedWebhookDelivery = vi.fn();

vi.mock("#@/stripe-webhook", () => {
  return {
    applyStripeWebhookJob: vi.fn(),
    processQueuedStripeWebhookJob: (...args: unknown[]) => processQueuedStripeWebhookJob(...args)
  };
});

vi.mock("@saasweave/app/batch-jobs/process", () => {
  return {
    processBatchJob: (batchJobId: string) => processBatchJobMock(batchJobId)
  };
});

vi.mock("#@/data-export-job", () => {
  return { runDataExportJob: (...args: unknown[]) => runDataExportJob(...args) };
});

vi.mock("#@/webhook-dispatch", () => {
  return {
    processQueuedWebhookDelivery: (...args: unknown[]) => processQueuedWebhookDelivery(...args)
  };
});

vi.mock("@saasweave/cache", () => {
  return {
    createRedisConnection: vi.fn(() => {
      return { quit: vi.fn() };
    })
  };
});

vi.mock("bullmq", () => {
  class Worker {
    name: string;
    on = vi.fn();
    close = vi.fn();
    constructor(name: string) {
      this.name = name;
    }
  }
  return { Worker };
});

const {
  createBatchJobsWorker,
  createDataExportWorker,
  createDomainWorkers,
  createStripeWorker,
  createWebhookWorker,
  processBatchJobsQueueJob,
  processDataExportQueueJob,
  processStripeWebhookJob,
  processWebhookDeliveryJob
} = await import("#@/domain-workers");

describe("domain worker processors", () => {
  beforeEach(() => {
    processQueuedStripeWebhookJob.mockClear();
    processBatchJobMock.mockClear();
    runDataExportJob.mockReset();
    processQueuedWebhookDelivery.mockReset();
  });

  it("routes stripe jobs through the stripe orchestrator", async () => {
    await processStripeWebhookJob({
      data: { eventId: "evt_1", payload: "{}", type: "x" },
      name: "process"
    } as Job<StripeWebhookJobData>);
    expect(processQueuedStripeWebhookJob).toHaveBeenCalledOnce();
  });

  it("delegates batch jobs to app processor", async () => {
    await processBatchJobsQueueJob({
      data: { batchJobId: "batch_1" },
      name: "process"
    } as Job<BatchJobData>);
    expect(processBatchJobMock).toHaveBeenCalledWith("batch_1");
  });

  it("routes data exports and webhook deliveries to their orchestrators", async () => {
    await processDataExportQueueJob({
      data: { requestId: "export_1" },
      name: "process"
    } as Job<DataExportJobData>);
    const delivery = {
      endpointId: "endpoint_1",
      payload: {
        createdAt: new Date().toISOString(),
        data: {},
        event: "usage.recorded",
        id: "event_1",
        organizationId: "org_1"
      },
      url: "https://example.test/hook"
    } satisfies WebhookDeliveryJobData;
    await processWebhookDeliveryJob({
      data: delivery,
      name: "deliver"
    } as Job<WebhookDeliveryJobData>);

    expect(runDataExportJob).toHaveBeenCalledWith("export_1");
    expect(processQueuedWebhookDelivery).toHaveBeenCalledWith(delivery);
  });

  it.each([
    [processStripeWebhookJob, "other", "Unknown stripe job: other"],
    [processDataExportQueueJob, "other", "Unknown data export job: other"],
    [processBatchJobsQueueJob, "other", "Unknown batch job: other"],
    [processWebhookDeliveryJob, "other", "Unknown webhook job: other"]
  ])("rejects unsupported job names", async (processor, name, message) => {
    await expect(processor({ data: {}, name } as never)).rejects.toThrow(message);
  });
});

describe("domain worker registration", () => {
  it("registers stripe and batch workers", () => {
    expect(createStripeWorker().name).toBe(QUEUE_NAMES.STRIPE);
    expect(createBatchJobsWorker().name).toBe(QUEUE_NAMES.BATCH_JOBS);
  });

  it("registers data-export and webhook workers and the complete domain set", () => {
    expect(createDataExportWorker().name).toBe(QUEUE_NAMES.DATA_EXPORT);
    expect(createWebhookWorker().name).toBe(QUEUE_NAMES.WEBHOOKS);
    expect(createDomainWorkers().map((worker) => worker.name)).toEqual([
      QUEUE_NAMES.STRIPE,
      QUEUE_NAMES.DATA_EXPORT,
      QUEUE_NAMES.BATCH_JOBS,
      QUEUE_NAMES.WEBHOOKS
    ]);
  });
});
