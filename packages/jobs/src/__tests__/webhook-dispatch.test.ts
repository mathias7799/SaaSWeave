import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { processQueuedWebhookDelivery } from "#@/webhook-dispatch";

const getEnabledWebhookTargets = vi.fn();
const getWebhookEndpoint = vi.fn();
const deliverWebhookHttp = vi.fn();
const enqueueWebhookDelivery = vi.fn();

vi.mock("@saasweave/cache", () => {
  return {
    isRedisEnabled: vi.fn(() => true)
  };
});

vi.mock("@saasweave/db", () => {
  return {
    deliverWebhookHttp: (...args: unknown[]) => deliverWebhookHttp(...args),
    getEnabledWebhookTargets: (...args: unknown[]) => getEnabledWebhookTargets(...args),
    getWebhookEndpoint: (...args: unknown[]) => getWebhookEndpoint(...args)
  };
});

vi.mock("#@/queues", () => {
  return {
    enqueueWebhookDelivery: (...args: unknown[]) => enqueueWebhookDelivery(...args)
  };
});

const { dispatchOrgWebhook } = await import("#@/webhook-dispatch");

function buildDeliveryInput() {
  return {
    endpointId: "ep_1",
    payload: {
      createdAt: "2026-01-01T00:00:00.000Z",
      data: { userId: "u1" },
      event: "member.added" as const,
      id: "wh_test_1",
      organizationId: "org_1"
    },
    url: "https://example.com/hook"
  };
}

describe("dispatchOrgWebhook", () => {
  beforeEach(() => {
    getEnabledWebhookTargets.mockReset();
    enqueueWebhookDelivery.mockReset();
    deliverWebhookHttp.mockReset();
    enqueueWebhookDelivery.mockResolvedValue(undefined);
    deliverWebhookHttp.mockResolvedValue({ ok: true, responseBody: "", responseStatus: 200 });
  });

  it("returns early when there are no enabled webhook targets", async () => {
    getEnabledWebhookTargets.mockResolvedValue([]);

    await dispatchOrgWebhook("org_1", "member.added", { userId: "u1" });

    expect(enqueueWebhookDelivery).not.toHaveBeenCalled();
    expect(deliverWebhookHttp).not.toHaveBeenCalled();
  });

  it("swallows lookup failures without throwing to callers", async () => {
    getEnabledWebhookTargets.mockRejectedValue(new Error("database unavailable"));

    await expect(
      dispatchOrgWebhook("org_1", "member.added", { userId: "u1" })
    ).resolves.toBeUndefined();
    expect(enqueueWebhookDelivery).not.toHaveBeenCalled();
  });
});

describe("processQueuedWebhookDelivery", () => {
  beforeEach(() => {
    getWebhookEndpoint.mockReset();
    deliverWebhookHttp.mockReset();
  });

  it("skips delivery when the endpoint was deleted after enqueue", async () => {
    getWebhookEndpoint.mockResolvedValue(null);

    await expect(processQueuedWebhookDelivery(buildDeliveryInput())).resolves.toBeUndefined();
    expect(deliverWebhookHttp).not.toHaveBeenCalled();
  });

  it("delivers with the endpoint secret when the endpoint still exists", async () => {
    getWebhookEndpoint.mockResolvedValue({
      events: ["member.added"],
      id: "ep_1",
      secret: "whsec_test",
      url: "https://example.com/hook"
    });
    deliverWebhookHttp.mockResolvedValue({ ok: true, responseBody: "ok", responseStatus: 200 });

    const input = buildDeliveryInput();
    await processQueuedWebhookDelivery(input);

    expect(getWebhookEndpoint).toHaveBeenCalledWith("org_1", "ep_1");
    expect(deliverWebhookHttp).toHaveBeenCalledWith({
      endpointId: "ep_1",
      payload: input.payload,
      secret: "whsec_test",
      url: "https://example.com/hook"
    });
  });

  it("throws on failed delivery so BullMQ can retry the job", async () => {
    getWebhookEndpoint.mockResolvedValue({
      events: ["member.added"],
      id: "ep_1",
      secret: "whsec_test",
      url: "https://example.com/hook"
    });
    deliverWebhookHttp.mockResolvedValue({
      ok: false,
      responseBody: "unavailable",
      responseStatus: 503
    });

    await expect(processQueuedWebhookDelivery(buildDeliveryInput())).rejects.toThrow(
      "Webhook delivery failed (status 503)"
    );
  });

  it("throws with network_error when delivery has no HTTP status", async () => {
    getWebhookEndpoint.mockResolvedValue({
      events: ["member.added"],
      id: "ep_1",
      secret: "whsec_test",
      url: "https://example.com/hook"
    });
    deliverWebhookHttp.mockResolvedValue({
      ok: false,
      responseBody: "network down",
      responseStatus: null
    });

    await expect(processQueuedWebhookDelivery(buildDeliveryInput())).rejects.toThrow(
      "Webhook delivery failed (status network_error)"
    );
  });
});
