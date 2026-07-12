import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const org = {
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    id: "org_1",
    name: "Acme",
    planId: "growth",
    stripeCustomerId: "cus_existing",
    stripeSubscriptionId: "sub_1",
    subscriptionStatus: "active"
  };
  return {
    applyJob: vi.fn(),
    checkoutCreate: vi.fn(),
    customerCreate: vi.fn(),
    env: {
      STRIPE_PRICES: '{"growth":{"monthly":"price_month","annual":"price_year"}}',
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123"
    },
    org,
    portalCreate: vi.fn(),
    selectRows: [org] as Array<Record<string, unknown>>,
    trialsEnabled: true,
    updateWhere: vi.fn(),
    webhookConstruct: vi.fn()
  };
});

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      billingPortal = { sessions: { create: mocks.portalCreate } };
      checkout = { sessions: { create: mocks.checkoutCreate } };
      customers = { create: mocks.customerCreate };
      webhooks = { constructEvent: mocks.webhookConstruct };
    }
  };
});

vi.mock("@saasweave/env/server/env", () => {
  return { ENV_SERVER: mocks.env };
});
vi.mock("@saasweave/db/schema", () => {
  return {
    organization: {
      cancelAtPeriodEnd: "cancelAtPeriodEnd",
      currentPeriodEnd: "currentPeriodEnd",
      id: "id",
      name: "name",
      planId: "planId",
      stripeCustomerId: "stripeCustomerId",
      stripeSubscriptionId: "stripeSubscriptionId",
      subscriptionStatus: "subscriptionStatus"
    }
  };
});
vi.mock("@saasweave/db", () => {
  return {
    db: {
      select: () => {
        return {
          from: () => {
            return {
              where: () => {
                return { limit: async () => mocks.selectRows };
              }
            };
          }
        };
      },
      update: () => {
        return {
          set: () => {
            return { where: mocks.updateWhere };
          }
        };
      }
    }
  };
});
vi.mock("#@/lib/settings", () => {
  return {
    getPlatformSettings: async () => {
      return { trialsEnabled: mocks.trialsEnabled };
    }
  };
});
vi.mock("@saasweave/jobs/stripe-webhook", () => {
  return { applyStripeWebhookJob: mocks.applyJob };
});
vi.mock("@saasweave/app/stripe/webhook-apply", () => {
  return {
    applyStripeWebhookEvent: vi.fn(),
    claimStripeWebhookEvent: vi.fn(),
    extractStripeCustomerId: vi.fn()
  };
});

import {
  constructWebhookEvent,
  createCheckoutSession,
  createPortalSession,
  getOrgBilling,
  getStripe,
  handleWebhookEvent,
  isStripeEnabled,
  priceFor
} from "#@/lib/stripe";

describe("Stripe adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.STRIPE_SECRET_KEY = "sk_test_123";
    mocks.env.STRIPE_PRICES = '{"growth":{"monthly":"price_month","annual":"price_year"}}';
    mocks.selectRows = [mocks.org];
    mocks.trialsEnabled = true;
  });

  it("validates configuration and resolves configured prices", () => {
    expect(isStripeEnabled()).toBe(true);
    expect(priceFor("growth", "monthly")).toBe("price_month");
    expect(priceFor("missing", "annual")).toBeUndefined();
    mocks.env.STRIPE_PRICES = "invalid";
    expect(priceFor("growth", "monthly")).toBeUndefined();
    mocks.env.STRIPE_SECRET_KEY = "";
    expect(isStripeEnabled()).toBe(false);
    expect(() => getStripe()).toThrow("Stripe is not configured");
  });

  it("loads organization billing and creates checkout for an existing customer", async () => {
    mocks.checkoutCreate.mockResolvedValue({ url: "https://stripe.test/checkout" });
    await expect(getOrgBilling("org_1")).resolves.toEqual(mocks.org);
    await expect(
      createCheckoutSession({
        cancelUrl: "https://app.test/cancel",
        interval: "monthly",
        organizationId: "org_1",
        planId: "growth",
        successUrl: "https://app.test/success"
      })
    ).resolves.toBe("https://stripe.test/checkout");
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        subscription_data: expect.objectContaining({ trial_period_days: 14 })
      })
    );
  });

  it("creates and persists a customer before opening the portal", async () => {
    mocks.selectRows = [{ ...mocks.org, stripeCustomerId: null }];
    mocks.customerCreate.mockResolvedValue({ id: "cus_new" });
    mocks.portalCreate.mockResolvedValue({ url: "https://stripe.test/portal" });
    await expect(
      createPortalSession({ organizationId: "org_1", returnUrl: "https://app.test/billing" })
    ).resolves.toBe("https://stripe.test/portal");
    expect(mocks.customerCreate).toHaveBeenCalledWith({
      metadata: { organizationId: "org_1" },
      name: "Acme"
    });
    expect(mocks.updateWhere).toHaveBeenCalled();
  });

  it("rejects missing organizations, prices, and checkout URLs", async () => {
    mocks.selectRows = [];
    await expect(
      createPortalSession({ organizationId: "missing", returnUrl: "https://app.test" })
    ).rejects.toThrow("Organization not found");

    mocks.selectRows = [mocks.org];
    await expect(
      createCheckoutSession({
        cancelUrl: "https://app.test",
        interval: "monthly",
        organizationId: "org_1",
        planId: "missing",
        successUrl: "https://app.test"
      })
    ).rejects.toThrow("No Stripe price configured");

    mocks.checkoutCreate.mockResolvedValue({ url: null });
    await expect(
      createCheckoutSession({
        cancelUrl: "https://app.test",
        interval: "annual",
        organizationId: "org_1",
        planId: "growth",
        successUrl: "https://app.test"
      })
    ).rejects.toThrow("Stripe did not return a checkout URL");
  });

  it("delegates webhook verification and processing", async () => {
    const event = { id: "evt_1", type: "customer.created" };
    mocks.webhookConstruct.mockReturnValue(event);
    expect(constructWebhookEvent("raw", "sig")).toBe(event);
    expect(mocks.webhookConstruct).toHaveBeenCalledWith("raw", "sig", "whsec_123");
    await handleWebhookEvent(event as never);
    expect(mocks.applyJob).toHaveBeenCalledWith(event);
  });
});
