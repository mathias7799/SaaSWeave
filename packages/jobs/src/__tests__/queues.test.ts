import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockAdd = vi.fn();
const mockClose = vi.fn();
const mockGetJobCounts = vi.fn();
const mockQuit = vi.fn();
const isRedisEnabled = vi.fn();
const createRedisConnection = vi.fn();

vi.mock("bullmq", () => {
  return {
    Queue: vi.fn(function () {
      return {
        add: mockAdd,
        close: mockClose,
        getJobCounts: mockGetJobCounts
      };
    }),
    Worker: vi.fn()
  };
});

vi.mock("@saasweave/cache", () => {
  return {
    createRedisConnection: (...args: unknown[]) => createRedisConnection(...args),
    isRedisEnabled: () => isRedisEnabled()
  };
});

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: { QUEUE_PREFIX: "test-prefix" }
  };
});

const {
  checkQueueReady,
  closeQueues,
  enqueueBatchJob,
  enqueueDataExport,
  enqueueNotification,
  enqueueStripeWebhook,
  enqueueTemplateEmail,
  enqueueWebhookDelivery,
  getQueue,
  QUEUE_DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES
} = await import("#@/queues");

describe("queue defaults", () => {
  it("retries failed jobs with exponential backoff before dead-lettering", () => {
    expect(QUEUE_DEFAULT_JOB_OPTIONS).toEqual({
      attempts: 3,
      backoff: { delay: 2_000, type: "exponential" },
      removeOnComplete: 1_000,
      removeOnFail: 5_000
    });
  });
});

describe("queue access", () => {
  beforeEach(async () => {
    await closeQueues();
    isRedisEnabled.mockReturnValue(true);
    createRedisConnection.mockReturnValue({ quit: mockQuit });
    mockAdd.mockReset();
    mockClose.mockReset();
    mockGetJobCounts.mockReset();
    mockQuit.mockReset();
    mockAdd.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockQuit.mockResolvedValue(undefined);
    mockGetJobCounts.mockResolvedValue({ delayed: 0, failed: 0, waiting: 0 });
  });

  it("throws when Redis is required but not configured", () => {
    isRedisEnabled.mockReturnValue(false);

    expect(() => getQueue(QUEUE_NAMES.EMAIL)).toThrow(
      "Redis is required before queues can be used. Set REDIS_URL."
    );
  });

  it("reuses queue instances from getQueue", () => {
    const first = getQueue(QUEUE_NAMES.EMAIL);
    const second = getQueue(QUEUE_NAMES.EMAIL);
    expect(second).toBe(first);
  });

  it("closes queue connections and clears cached queues", async () => {
    getQueue(QUEUE_NAMES.EMAIL);
    await closeQueues();

    expect(mockClose).toHaveBeenCalled();
    expect(mockQuit).toHaveBeenCalled();
  });
});

describe("enqueue helpers", () => {
  beforeEach(async () => {
    await closeQueues();
    isRedisEnabled.mockReturnValue(true);
    createRedisConnection.mockReturnValue({ quit: mockQuit });
    mockAdd.mockReset();
    mockAdd.mockResolvedValue(undefined);
  });

  it("deduplicates stripe webhook jobs by event id", async () => {
    await enqueueStripeWebhook({
      eventId: "evt_123",
      payload: '{"id":"evt_123"}',
      type: "customer.subscription.updated"
    });

    expect(mockAdd).toHaveBeenCalledWith(
      "process",
      {
        eventId: "evt_123",
        payload: '{"id":"evt_123"}',
        type: "customer.subscription.updated"
      },
      expect.objectContaining({ jobId: "stripe-evt_123" })
    );
  });

  it("enqueues template email jobs", async () => {
    const data = {
      key: "welcome",
      meta: { organizationId: "org_1" },
      to: "user@example.com",
      values: { name: "Ada" }
    };

    await enqueueTemplateEmail(data);

    expect(mockAdd).toHaveBeenCalledWith("send-template", data, {});
  });

  it("enqueues notification jobs", async () => {
    const data = {
      audience: { kind: "user" as const, userId: "user_1" },
      organizationId: "org_1",
      title: "Hello",
      type: "info"
    };

    await enqueueNotification(data);

    expect(mockAdd).toHaveBeenCalledWith("create", data, {});
  });

  it("enqueues webhook delivery jobs", async () => {
    const data = {
      endpointId: "ep_1",
      payload: {
        createdAt: "2026-01-01T00:00:00.000Z",
        data: { userId: "u1" },
        event: "member.added" as const,
        id: "wh_1",
        organizationId: "org_1"
      },
      url: "https://example.com/hook"
    };

    await enqueueWebhookDelivery(data);

    expect(mockAdd).toHaveBeenCalledWith("deliver", data, {});
  });

  it("deduplicates data export jobs by request id", async () => {
    await enqueueDataExport({ requestId: "req_1" });

    expect(mockAdd).toHaveBeenCalledWith(
      "process",
      { requestId: "req_1" },
      expect.objectContaining({ jobId: "data-export-req_1" })
    );
  });

  it("deduplicates batch jobs by batch job id", async () => {
    await enqueueBatchJob({ batchJobId: "batch_1" });

    expect(mockAdd).toHaveBeenCalledWith(
      "process",
      { batchJobId: "batch_1" },
      expect.objectContaining({ jobId: "batch-job-batch_1" })
    );
  });
});

describe("checkQueueReady", () => {
  beforeEach(async () => {
    await closeQueues();
    isRedisEnabled.mockReturnValue(true);
    createRedisConnection.mockReturnValue({ quit: mockQuit });
    mockGetJobCounts.mockReset();
    mockGetJobCounts.mockResolvedValue({ delayed: 0, failed: 0, waiting: 0 });
  });

  it("reports healthy when Redis is not configured", async () => {
    isRedisEnabled.mockReturnValue(false);

    await expect(checkQueueReady()).resolves.toEqual({
      configured: false,
      status: "healthy"
    });
  });

  it("aggregates pending and failed counts across queues", async () => {
    mockGetJobCounts
      .mockResolvedValueOnce({ delayed: 1, failed: 2, waiting: 3 })
      .mockResolvedValue({ delayed: 0, failed: 0, waiting: 0 });

    await expect(checkQueueReady()).resolves.toEqual({
      configured: true,
      failed: 2,
      pending: 4,
      status: "healthy"
    });
  });

  it("marks the queue as degraded when failed jobs exceed the threshold", async () => {
    mockGetJobCounts.mockResolvedValue({ delayed: 0, failed: 101, waiting: 0 });

    await expect(checkQueueReady()).resolves.toEqual({
      configured: true,
      failed: 707,
      pending: 0,
      status: "degraded"
    });
  });

  it("marks the queue as unhealthy when counts cannot be read", async () => {
    mockGetJobCounts.mockRejectedValue(new Error("redis unavailable"));

    await expect(checkQueueReady()).resolves.toEqual({
      configured: true,
      status: "unhealthy"
    });
  });
});
