import { describe, expect, it } from "vite-plus/test";

import { summarizeApiKeyScopes } from "#@/lib/api-key-scopes";
import { resolvePlanEntry } from "#@/lib/plans";
import { extractStripeCustomerId } from "#@/lib/stripe";

describe("plan catalog helpers", () => {
  const catalog = new Map([
    ["growth", { name: "Growth", price: 99, seats: 10 }],
    ["scale", { name: "Scale", price: 199, seats: 25 }]
  ]);

  it("resolvePlanEntry falls back to Free for unknown or missing plan ids", () => {
    expect(resolvePlanEntry(catalog, null)).toEqual({ name: "Free", price: 0, seats: 3 });
    expect(resolvePlanEntry(catalog, "missing")).toEqual({ name: "Free", price: 0, seats: 3 });
    expect(resolvePlanEntry(catalog, "growth").name).toBe("Growth");
  });
});

describe("api key scope summary", () => {
  it("normalizes legacy empty scopes to the full scope set", () => {
    const scopes = summarizeApiKeyScopes([]);
    expect(scopes).toContain("usage:write");
    expect(scopes).toContain("audit:read");
  });
});

describe("extractStripeCustomerId", () => {
  it("reads customer ids from subscription and invoice webhook events", () => {
    expect(
      extractStripeCustomerId({
        data: { object: { customer: "cus_sub" } },
        type: "customer.subscription.updated"
      } as never)
    ).toBe("cus_sub");

    expect(
      extractStripeCustomerId({
        data: { object: { customer: { id: "cus_invoice" } } },
        type: "invoice.paid"
      } as never)
    ).toBe("cus_invoice");

    expect(
      extractStripeCustomerId({
        data: { object: {} },
        type: "account.updated"
      } as never)
    ).toBeNull();
  });
});
