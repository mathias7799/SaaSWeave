import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";

import {
  createFlushClient,
  describeRedis,
  shutdownJobQueues
} from "#@/__tests__/redis-test-helpers";
import {
  enqueueBatchJob,
  enqueueDataExport,
  enqueueNotification,
  enqueueStripeWebhook,
  enqueueTemplateEmail,
  enqueueWebhookDelivery,
  getQueue,
  QUEUE_NAMES
} from "#@/queues";

describeRedis("queues with Redis", () => {
  let flushClient: ReturnType<typeof createFlushClient>;

  beforeAll(async () => {
    flushClient = createFlushClient();
    await flushClient.ping();
  });

  beforeEach(async () => {
    await shutdownJobQueues();
    await flushClient.flushdb();
  });

  afterEach(async () => {
    await shutdownJobQueues();
  });

  afterAll(async () => {
    await flushClient.quit();
  });

  it("reuses the same queue instance from getQueue", () => {
    const first = getQueue(QUEUE_NAMES.EMAIL);
    const second = getQueue(QUEUE_NAMES.EMAIL);
    expect(second).toBe(first);
  });

  it("enqueues template email jobs on the email queue", async () => {
    const job = await enqueueTemplateEmail({
      key: "welcome",
      meta: { organizationId: "org_1" },
      to: "user@example.com",
      values: { name: "Ada" }
    });

    expect(job.name).toBe("send-template");
    expect(job.queueName).toBe(QUEUE_NAMES.EMAIL);
    expect(job.data).toEqual({
      key: "welcome",
      meta: { organizationId: "org_1" },
      to: "user@example.com",
      values: { name: "Ada" }
    });
  });

  it("enqueues notification jobs on the notifications queue", async () => {
    const data = {
      audience: { kind: "user" as const, userId: "user_1" },
      organizationId: "org_1",
      title: "Hello",
      type: "info"
    };

    const job = await enqueueNotification(data);

    expect(job.name).toBe("create");
    expect(job.queueName).toBe(QUEUE_NAMES.NOTIFICATIONS);
    expect(job.data).toEqual(data);
  });

  it("enqueues webhook delivery jobs on the webhooks queue", async () => {
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

    const job = await enqueueWebhookDelivery(data);

    expect(job.name).toBe("deliver");
    expect(job.queueName).toBe(QUEUE_NAMES.WEBHOOKS);
    expect(job.data).toEqual(data);
  });

  it("deduplicates jobs that share the same BullMQ jobId", async () => {
    const queue = getQueue(QUEUE_NAMES.EMAIL);
    const data = { key: "welcome", to: "user@example.com" };
    const jobId = `dedup-${crypto.randomUUID()}`;

    await queue.add("send-template", data, { jobId });
    await queue.add("send-template", data, { jobId });

    const waiting = await queue.getJobs(["waiting", "delayed", "active"]);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]?.id).toBe(jobId);
  });

  it("passes stripe dedup job ids to BullMQ", async () => {
    const eventId = `evt_${crypto.randomUUID()}`;
    const addSpy = vi.spyOn(getQueue(QUEUE_NAMES.STRIPE), "add");

    await expect(
      enqueueStripeWebhook({
        eventId,
        payload: `{"id":"${eventId}"}`,
        type: "customer.subscription.updated"
      })
    ).rejects.toThrow("Custom Id cannot contain :");

    expect(addSpy).toHaveBeenCalledWith(
      "process",
      {
        eventId,
        payload: `{"id":"${eventId}"}`,
        type: "customer.subscription.updated"
      },
      expect.objectContaining({ jobId: `stripe:${eventId}` })
    );

    addSpy.mockRestore();
  });

  it("passes data export dedup job ids to BullMQ", async () => {
    const requestId = crypto.randomUUID();
    const addSpy = vi.spyOn(getQueue(QUEUE_NAMES.DATA_EXPORT), "add");

    await expect(enqueueDataExport({ requestId })).rejects.toThrow("Custom Id cannot contain :");
    expect(addSpy).toHaveBeenCalledWith(
      "process",
      { requestId },
      expect.objectContaining({ jobId: `data-export:${requestId}` })
    );

    addSpy.mockRestore();
  });

  it("passes batch job dedup ids to BullMQ", async () => {
    const batchJobId = crypto.randomUUID();
    const addSpy = vi.spyOn(getQueue(QUEUE_NAMES.BATCH_JOBS), "add");

    await expect(enqueueBatchJob({ batchJobId })).rejects.toThrow("Custom Id cannot contain :");
    expect(addSpy).toHaveBeenCalledWith(
      "process",
      { batchJobId },
      expect.objectContaining({ jobId: `batch-job:${batchJobId}` })
    );

    addSpy.mockRestore();
  });

  it("closes queue connections so producers can shut down cleanly", async () => {
    await enqueueTemplateEmail({ key: "welcome", to: "user@example.com" });
    await shutdownJobQueues();

    const queue = getQueue(QUEUE_NAMES.EMAIL);
    await expect(queue.getJobCounts("waiting")).resolves.toBeTypeOf("object");
    await shutdownJobQueues();
  });
});
