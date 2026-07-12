import { describe, expect, it } from "vite-plus/test";

import {
  isStaleStripeEvent,
  stripeCustomerAdvisoryLockKeys,
  STRIPE_CUSTOMER_ADVISORY_LOCK_NAMESPACE
} from "@saasweave/db/stripe-webhook-ordering";

describe("stripeCustomerAdvisoryLockKeys", () => {
  it("derives stable advisory lock keys from a customer id", () => {
    const first = stripeCustomerAdvisoryLockKeys("cus_test_123");
    const second = stripeCustomerAdvisoryLockKeys("cus_test_123");
    expect(first).toEqual(second);
    expect(first[0]).toBe(STRIPE_CUSTOMER_ADVISORY_LOCK_NAMESPACE);
  });
});

describe("isStaleStripeEvent", () => {
  it("treats missing last-applied timestamps as never stale", () => {
    expect(isStaleStripeEvent(1_700_000_000, null)).toBe(false);
    expect(isStaleStripeEvent(1_700_000_000, undefined)).toBe(false);
  });

  it("marks events at or before the last applied timestamp as stale", () => {
    const lastApplied = new Date("2026-06-01T12:00:00.000Z");
    expect(isStaleStripeEvent(Math.floor(lastApplied.getTime() / 1000), lastApplied)).toBe(true);
    expect(isStaleStripeEvent(Math.floor(lastApplied.getTime() / 1000) - 1, lastApplied)).toBe(
      true
    );
    expect(isStaleStripeEvent(Math.floor(lastApplied.getTime() / 1000) + 1, lastApplied)).toBe(
      false
    );
  });
});
