import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    enabled: true,
    getOrgBilling: vi.fn(),
    invoicesList: vi.fn(),
    customerRetrieve: vi.fn(),
    subscriptionRetrieve: vi.fn()
  };
});

vi.mock("#@/lib/stripe", () => {
  return {
    getOrgBilling: mocks.getOrgBilling,
    getStripe: () => {
      return {
        customers: { retrieve: mocks.customerRetrieve },
        invoices: { list: mocks.invoicesList },
        subscriptions: { retrieve: mocks.subscriptionRetrieve }
      };
    },
    isStripeEnabled: () => mocks.enabled
  };
});

import { fetchStripeBillingDetails } from "#@/lib/stripe-billing";

describe("fetchStripeBillingDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
  });

  it("returns null when Stripe or the organization customer is unavailable", async () => {
    mocks.enabled = false;
    await expect(fetchStripeBillingDetails("org_1")).resolves.toBeNull();

    mocks.enabled = true;
    mocks.getOrgBilling.mockResolvedValue({ stripeCustomerId: null });
    await expect(fetchStripeBillingDetails("org_1")).resolves.toBeNull();
  });

  it("normalizes invoices, payment method, and annual subscription", async () => {
    mocks.getOrgBilling.mockResolvedValue({
      planId: "growth",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1"
    });
    mocks.invoicesList.mockResolvedValue({
      data: [
        { amount_paid: 1299, created: 1_700_000_000, id: "inv_paid", number: null, status: "paid" },
        { amount_paid: 500, created: 1_700_000_100, id: null, number: null, status: "open" },
        { amount_paid: 700, created: 1_700_000_200, id: "inv_due", number: "DUE-1", status: null }
      ]
    });
    mocks.customerRetrieve.mockResolvedValue({
      deleted: false,
      invoice_settings: {
        default_payment_method: {
          card: { brand: "visa", exp_month: 12, exp_year: 2030, last4: "4242" }
        }
      }
    });
    mocks.subscriptionRetrieve.mockResolvedValue({
      items: {
        data: [
          {
            current_period_end: 1_800_000_000,
            price: { recurring: { interval: "year" } },
            quantity: 4
          }
        ]
      },
      metadata: { planId: "scale" },
      start_date: 1_700_000_000,
      status: "trialing"
    });

    const result = await fetchStripeBillingDetails("org_1");

    expect(result?.invoices.map((invoice) => invoice.status)).toEqual(["paid", "open", "past_due"]);
    expect(result?.invoices[0]).toMatchObject({ amount: 12.99, number: "inv_paid" });
    expect(result?.invoices[1]?.id).toBe("inv_1700000100");
    expect(result?.paymentMethod).toEqual({
      brand: "visa",
      expMonth: 12,
      expYear: 2030,
      last4: "4242"
    });
    expect(result?.subscription).toMatchObject({
      interval: "annual",
      planId: "scale",
      seats: 4,
      status: "trialing"
    });
  });

  it("handles deleted customers and a missing subscription", async () => {
    mocks.getOrgBilling.mockResolvedValue({
      planId: null,
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: null
    });
    mocks.invoicesList.mockResolvedValue({ data: [] });
    mocks.customerRetrieve.mockResolvedValue({ deleted: true });

    await expect(fetchStripeBillingDetails("org_1")).resolves.toEqual({
      invoices: [],
      paymentMethod: null,
      subscription: undefined
    });
    expect(mocks.subscriptionRetrieve).not.toHaveBeenCalled();
  });
});
