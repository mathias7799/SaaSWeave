import { createHmac } from "node:crypto";

import { type Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { signWebhookPayload } from "@saasweave/db";
import {
  type WebhookDeliveryJobData,
  QUEUE_DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES
} from "@saasweave/jobs/queues";
import { processQueuedWebhookDelivery } from "@saasweave/jobs/webhook-dispatch";

import "#@/__tests__/worker-test-hoisted";
import { mockWorkerInstances, resetWorkerTestMocks } from "#@/__tests__/worker-test-hoisted";

const getWebhookEndpoint = vi.fn();
const deliverWebhookHttp = vi.fn();

vi.mock("@saasweave/db", () => {
  return {
    deliverWebhookHttp: (...args: unknown[]) => deliverWebhookHttp(...args),
    getEmailCopy: vi.fn(),
    getWebhookEndpoint: (...args: unknown[]) => getWebhookEndpoint(...args),
    recordEmailDelivery: vi.fn(),
    signWebhookPayload: (secret: string, body: string, timestamp: number) =>
      createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")
  };
});

const { createWebhookWorker, processWebhookDeliveryJob } =
  await import("@saasweave/jobs/domain-workers");

function buildDeliveryJob(
  overrides: Partial<WebhookDeliveryJobData> = {}
): Job<WebhookDeliveryJobData> {
  return {
    data: {
      endpointId: "ep_1",
      payload: {
        createdAt: "2026-01-01T00:00:00.000Z",
        data: { userId: "u1" },
        event: "member.added",
        id: "wh_test_1",
        organizationId: "org_1"
      },
      url: "https://93.184.216.34/hook",
      ...overrides
    },
    id: "job_1",
    name: "deliver",
    queueName: "webhooks"
  } as Job<WebhookDeliveryJobData>;
}

function buildDeliveryInput() {
  return buildDeliveryJob().data;
}

describe("processWebhookDeliveryJob", () => {
  beforeEach(() => {
    getWebhookEndpoint.mockReset();
    deliverWebhookHttp.mockReset();
  });

  it("rejects unknown job names so BullMQ can surface a hard failure", async () => {
    const job = Object.assign(buildDeliveryJob(), {
      name: "unknown"
    }) as Job<WebhookDeliveryJobData>;
    await expect(processWebhookDeliveryJob(job)).rejects.toThrow("Unknown webhook job: unknown");
  });

  it("delegates deliver jobs to the queued webhook processor", async () => {
    getWebhookEndpoint.mockResolvedValue({
      events: ["member.added"],
      id: "ep_1",
      secret: "whsec_test",
      url: "https://93.184.216.34/hook"
    });
    deliverWebhookHttp.mockResolvedValue({ ok: true, responseBody: "ok", responseStatus: 200 });

    await processWebhookDeliveryJob(buildDeliveryJob());

    expect(getWebhookEndpoint).toHaveBeenCalledWith("org_1", "ep_1");
    expect(deliverWebhookHttp).toHaveBeenCalledOnce();
  });
});

describe("createWebhookWorker", () => {
  beforeEach(() => {
    resetWorkerTestMocks();
  });

  it("registers a BullMQ worker on the webhooks queue", () => {
    const worker = createWebhookWorker();

    expect(worker.name).toBe(QUEUE_NAMES.WEBHOOKS);
    expect(mockWorkerInstances).toHaveLength(1);
    expect(mockWorkerInstances[0]?.processor).toBe(processWebhookDeliveryJob);
  });

  it("throws when Redis is unavailable", async () => {
    const { createRedisConnection } = await import("@saasweave/cache");
    vi.mocked(createRedisConnection).mockReturnValueOnce(null);

    expect(() => createWebhookWorker()).toThrow(
      "Redis is required before workers can start. Set REDIS_URL."
    );
  });
});

describe("processQueuedWebhookDelivery signing and retry", () => {
  const secret = "whsec_test";

  beforeEach(() => {
    getWebhookEndpoint.mockReset();
    deliverWebhookHttp.mockReset();
    getWebhookEndpoint.mockResolvedValue({
      events: ["member.added"],
      id: "ep_1",
      secret,
      url: "https://93.184.216.34/hook"
    });
  });

  it("passes endpoint secrets into HTTP delivery so signing uses the package HMAC scheme", async () => {
    const input = buildDeliveryInput();
    const body = JSON.stringify(input.payload);
    const timestamp = 1_767_274_800;
    const signature = signWebhookPayload(secret, body, timestamp);

    deliverWebhookHttp.mockImplementation(async (deliveryInput) => {
      const deliveryBody = JSON.stringify(deliveryInput.payload);
      expect(deliveryBody).toBe(body);
      expect(deliveryInput.secret).toBe(secret);
      expect(signWebhookPayload(deliveryInput.secret, deliveryBody, timestamp)).toBe(signature);
      return { ok: true, responseBody: "ok", responseStatus: 200 };
    });

    await processQueuedWebhookDelivery(input);

    expect(deliverWebhookHttp).toHaveBeenCalledWith({
      endpointId: "ep_1",
      payload: input.payload,
      secret,
      url: "https://93.184.216.34/hook"
    });
  });

  it("formats X-SaaSWeave-Signature as t=<unix>,v1=<hmac> when delivering over HTTP", async () => {
    const input = buildDeliveryInput();
    const body = JSON.stringify(input.payload);
    const timestamp = 1_767_274_800;
    const signature = signWebhookPayload(secret, body, timestamp);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok"
    });
    vi.stubGlobal("fetch", fetchMock);

    deliverWebhookHttp.mockImplementation(async (deliveryInput) => {
      const deliveryBody = JSON.stringify(deliveryInput.payload);
      const deliverySignature = signWebhookPayload(deliveryInput.secret, deliveryBody, timestamp);
      await fetch(deliveryInput.url, {
        body: deliveryBody,
        headers: {
          "Content-Type": "application/json",
          "X-SaaSWeave-Signature": `t=${timestamp},v1=${deliverySignature}`,
          "X-SaaSWeave-Event": deliveryInput.payload.event
        },
        method: "POST"
      });
      return { ok: true, responseBody: "ok", responseStatus: 200 };
    });

    await processQueuedWebhookDelivery(input);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://93.184.216.34/hook",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-SaaSWeave-Signature": `t=${timestamp},v1=${signature}`
        })
      })
    );
  });

  it("throws on non-2xx responses so BullMQ can retry the delivery", async () => {
    deliverWebhookHttp.mockResolvedValue({
      ok: false,
      responseBody: "unavailable",
      responseStatus: 503
    });

    await expect(processQueuedWebhookDelivery(buildDeliveryInput())).rejects.toThrow(
      "Webhook delivery failed (status 503)"
    );
  });

  it("uses queue default retry/backoff options for webhook jobs", () => {
    expect(QUEUE_DEFAULT_JOB_OPTIONS).toEqual({
      attempts: 3,
      backoff: { delay: 2_000, type: "exponential" },
      removeOnComplete: 1_000,
      removeOnFail: 5_000
    });
  });
});
