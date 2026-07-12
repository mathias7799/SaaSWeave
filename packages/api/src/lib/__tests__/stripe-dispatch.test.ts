import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    apply: vi.fn(),
    enqueue: vi.fn(),
    error: vi.fn(),
    redisEnabled: true
  };
});

vi.mock("@saasweave/cache", () => {
  return { isRedisEnabled: () => mocks.redisEnabled };
});
vi.mock("@saasweave/jobs/queues", () => {
  return { enqueueStripeWebhook: mocks.enqueue };
});
vi.mock("@saasweave/jobs/stripe-webhook", () => {
  return {
    applyStripeWebhookJob: mocks.apply,
    processQueuedStripeWebhookJob: vi.fn()
  };
});
vi.mock("@saasweave/logger/server", () => {
  return {
    createLogger: () => {
      return { error: mocks.error };
    }
  };
});

import { dispatchStripeWebhook } from "#@/lib/stripe-dispatch";

describe("dispatchStripeWebhook", () => {
  const event = { id: "evt_1", type: "invoice.paid" } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisEnabled = true;
  });

  it("queues events when Redis is enabled", async () => {
    await dispatchStripeWebhook(event);
    expect(mocks.enqueue).toHaveBeenCalledWith({
      eventId: "evt_1",
      payload: JSON.stringify(event),
      type: "invoice.paid"
    });
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("applies events inline when Redis is disabled", async () => {
    mocks.redisEnabled = false;
    await dispatchStripeWebhook(event);
    expect(mocks.apply).toHaveBeenCalledWith(event);
  });

  it.each([new Error("queue down"), "queue down"])("logs and rethrows %s", async (failure) => {
    mocks.enqueue.mockRejectedValue(failure);
    await expect(dispatchStripeWebhook(event)).rejects.toBe(failure);
    expect(mocks.error).toHaveBeenCalledWith(
      failure instanceof Error ? failure : String(failure),
      expect.objectContaining({ event: "stripe_webhook_dispatch_failed", stripeEventId: "evt_1" })
    );
  });
});
