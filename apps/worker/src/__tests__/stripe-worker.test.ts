import { describe, expect, it, vi } from "vite-plus/test";

import { QUEUE_NAMES } from "@saasweave/jobs/queues";

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

const { createBatchJobsWorker, createDataExportWorker, createStripeWorker, createWebhookWorker } =
  await import("@saasweave/jobs/domain-workers");

describe("worker registration", () => {
  it("creates domain queue workers", () => {
    expect(createStripeWorker().name).toBe(QUEUE_NAMES.STRIPE);
    expect(createDataExportWorker().name).toBe(QUEUE_NAMES.DATA_EXPORT);
    expect(createBatchJobsWorker().name).toBe(QUEUE_NAMES.BATCH_JOBS);
    expect(createWebhookWorker().name).toBe(QUEUE_NAMES.WEBHOOKS);
  });
});
