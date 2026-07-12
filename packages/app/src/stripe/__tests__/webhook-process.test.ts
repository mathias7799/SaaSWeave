import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    acquireLock: vi.fn(),
    apply: vi.fn(),
    claim: vi.fn(),
    extractCustomer: vi.fn(),
    getLast: vi.fn(),
    isStale: vi.fn(),
    rootDb: { transaction: vi.fn() },
    setLast: vi.fn(),
    transactionDb: { kind: "transaction" }
  };
});

vi.mock("@saasweave/db", () => {
  return {
    acquireStripeCustomerAdvisoryXactLock: mocks.acquireLock,
    db: mocks.rootDb,
    getLastStripeEventAtForCustomer: mocks.getLast,
    isStaleStripeEvent: mocks.isStale,
    setLastStripeEventAtForCustomer: mocks.setLast
  };
});
vi.mock("#@/stripe/webhook-apply", () => {
  return {
    applyStripeWebhookEvent: mocks.apply,
    claimStripeWebhookEvent: mocks.claim,
    extractStripeCustomerId: mocks.extractCustomer
  };
});

import { applyStripeWebhookInline, processQueuedStripeWebhook } from "#@/stripe/webhook-process";

function event(input: { created?: number; id?: string; type?: string } = {}) {
  return {
    created: input.created ?? 1_720_000_000,
    data: { object: {} },
    id: input.id ?? "evt_1",
    type: input.type ?? "invoice.paid"
  };
}

describe("ordered Stripe webhook processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acquireLock.mockResolvedValue(undefined);
    mocks.apply.mockResolvedValue({});
    mocks.claim.mockResolvedValue(true);
    mocks.extractCustomer.mockReturnValue("cus_1");
    mocks.getLast.mockResolvedValue(null);
    mocks.isStale.mockReturnValue(false);
    mocks.setLast.mockResolvedValue(undefined);
    mocks.rootDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(mocks.transactionDb)
    );
  });

  it("drops events that were already claimed", async () => {
    mocks.claim.mockResolvedValue(false);
    await expect(
      applyStripeWebhookInline(event() as never, "https://app.test/billing")
    ).resolves.toEqual({});
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.rootDb.transaction).not.toHaveBeenCalled();
  });

  it("applies customerless events without a customer lock", async () => {
    const stripeEvent = event({ type: "account.updated" });
    mocks.extractCustomer.mockReturnValue(null);
    mocks.apply.mockResolvedValue({ subscriptionCreated: { organizationId: "org-1" } });

    await expect(
      applyStripeWebhookInline(stripeEvent as never, "https://app.test/billing")
    ).resolves.toEqual({ subscriptionCreated: { organizationId: "org-1" } });
    expect(mocks.apply).toHaveBeenCalledWith(stripeEvent, mocks.rootDb, {
      manageUrl: "https://app.test/billing"
    });
    expect(mocks.acquireLock).not.toHaveBeenCalled();
  });

  it("locks and suppresses stale customer events", async () => {
    const stripeEvent = event();
    const lastApplied = new Date("2026-07-01T00:00:00Z");
    mocks.getLast.mockResolvedValue(lastApplied);
    mocks.isStale.mockReturnValue(true);

    await expect(
      applyStripeWebhookInline(stripeEvent as never, "https://app.test/billing")
    ).resolves.toEqual({});
    expect(mocks.acquireLock).toHaveBeenCalledWith("cus_1", mocks.transactionDb);
    expect(mocks.isStale).toHaveBeenCalledWith(stripeEvent.created, lastApplied);
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.setLast).not.toHaveBeenCalled();
  });

  it("applies current events and persists their ordering timestamp", async () => {
    const stripeEvent = event({ created: 1_720_000_123 });
    mocks.apply.mockResolvedValue({});

    await applyStripeWebhookInline(stripeEvent as never, "https://app.test/billing");
    expect(mocks.apply).toHaveBeenCalledWith(stripeEvent, mocks.transactionDb, {
      manageUrl: "https://app.test/billing"
    });
    expect(mocks.setLast).toHaveBeenCalledWith(
      "cus_1",
      new Date(stripeEvent.created * 1_000),
      mocks.transactionDb
    );
  });

  it("parses queued event payloads before ordered application", async () => {
    const stripeEvent = event({ id: "evt_queue" });
    await processQueuedStripeWebhook(
      { eventId: stripeEvent.id, payload: JSON.stringify(stripeEvent), type: stripeEvent.type },
      "https://app.test/billing"
    );

    expect(mocks.claim).toHaveBeenCalledWith(stripeEvent);
  });
});
