import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    inserted: [] as unknown[],
    returning: vi.fn(),
    recordAudit: vi.fn()
  };
});

vi.mock("drizzle-orm", () => {
  return { and: vi.fn(), eq: vi.fn() };
});
vi.mock("@saasweave/db/schema", () => {
  return {
    member: { organizationId: {}, role: {}, userId: {} },
    organization: { id: {}, stripeCustomerId: {} },
    processedEvent: { id: {} },
    user: { email: {}, id: {}, name: {} }
  };
});
vi.mock("@saasweave/db", () => {
  return {
    db: {
      insert: () => {
        return {
          values: (value: unknown) => {
            mocks.inserted.push(value);
            return {
              onConflictDoNothing: () => {
                return { returning: mocks.returning };
              }
            };
          }
        };
      }
    },
    recordAudit: mocks.recordAudit
  };
});
vi.mock("@saasweave/env/server/env", () => {
  return { ENV_SERVER: { VITE_WEB_URL: "https://app.test" } };
});
vi.mock("#@/billing/plan-catalog", () => {
  return { planName: vi.fn(async () => "Growth") };
});

import {
  applyStripeWebhookEvent,
  claimStripeWebhookEvent,
  extractStripeCustomerId
} from "#@/stripe/webhook-apply";

function stripeEvent(type: string, object: unknown, id = "evt_1") {
  return { data: { object }, id, type } as never;
}

describe("Stripe webhook claim and customer extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inserted.length = 0;
  });

  it.each([
    ["customer.subscription.created", { customer: "cus_string" }, "cus_string"],
    ["customer.subscription.updated", { customer: { id: "cus_object" } }, "cus_object"],
    ["customer.subscription.deleted", { customer: null }, null],
    ["invoice.payment_failed", { customer: "cus_invoice" }, "cus_invoice"],
    ["invoice.paid", { customer: { id: "cus_paid" } }, "cus_paid"],
    ["account.updated", {}, null]
  ])("extracts customer from %s", (type, object, expected) => {
    expect(extractStripeCustomerId(stripeEvent(type, object))).toBe(expected);
  });

  it("claims a new event with a namespaced idempotency key", async () => {
    mocks.returning.mockResolvedValue([{ id: "stripe:evt_new" }]);

    await expect(claimStripeWebhookEvent(stripeEvent("invoice.paid", {}, "evt_new"))).resolves.toBe(
      true
    );
    expect(mocks.inserted).toEqual([{ id: "stripe:evt_new", source: "stripe" }]);
  });

  it("returns false when the event was already claimed", async () => {
    mocks.returning.mockResolvedValue([]);
    await expect(
      claimStripeWebhookEvent(stripeEvent("invoice.paid", {}, "evt_existing"))
    ).resolves.toBe(false);
  });

  it("looks up and audits a paid invoice organization", async () => {
    const executor = {
      select: () => {
        return {
          from: () => {
            return {
              where: () => {
                return { limit: async () => [{ id: "org-1" }] };
              }
            };
          }
        };
      }
    };
    const invoice = {
      amount_paid: 4_900,
      customer: "cus_1",
      id: "in_1"
    };

    await expect(
      applyStripeWebhookEvent(stripeEvent("invoice.paid", invoice), executor as never)
    ).resolves.toEqual({});
    expect(mocks.recordAudit).toHaveBeenCalledWith({
      action: "billing.invoice_paid",
      metadata: { amountPaid: 4_900 },
      organizationId: "org-1",
      targetLabel: "in_1",
      targetType: "invoice"
    });
  });

  it("audits failed payments using organization metadata without a lookup", async () => {
    const executor = { select: vi.fn() };
    const invoice = {
      customer: null,
      id: "in_failed",
      metadata: { organizationId: "org-2" }
    };

    await expect(
      applyStripeWebhookEvent(stripeEvent("invoice.payment_failed", invoice), executor as never)
    ).resolves.toEqual({});
    expect(executor.select).not.toHaveBeenCalled();
    expect(mocks.recordAudit).toHaveBeenCalledWith({
      action: "billing.payment_failed",
      organizationId: "org-2",
      targetLabel: "in_failed",
      targetType: "invoice"
    });
  });
});
