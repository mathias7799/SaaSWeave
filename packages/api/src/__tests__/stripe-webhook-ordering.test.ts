import { describe, expect, it } from "vite-plus/test";

import {
  isStaleStripeEvent,
  stripeCustomerAdvisoryLockKeys
} from "@saasweave/db/stripe-webhook-ordering";

describe("stripe webhook ordering guard", () => {
  it("derives stable advisory lock keys from the Stripe customer id", () => {
    const keysA = stripeCustomerAdvisoryLockKeys("cus_test123");
    const keysB = stripeCustomerAdvisoryLockKeys("cus_test123");
    const keysOther = stripeCustomerAdvisoryLockKeys("cus_other");

    expect(keysA).toEqual(keysB);
    expect(keysA).not.toEqual(keysOther);
    expect(keysA[0]).toBe(847_262_002);
  });

  it("treats missing last-applied timestamp as not stale", () => {
    expect(isStaleStripeEvent(1_700_000_000, null)).toBe(false);
    expect(isStaleStripeEvent(1_700_000_000, undefined)).toBe(false);
  });

  it("skips events older than the last applied Stripe event", () => {
    const lastApplied = new Date(1_700_000_000 * 1000);
    expect(isStaleStripeEvent(1_699_999_999, lastApplied)).toBe(true);
    expect(isStaleStripeEvent(1_700_000_000, lastApplied)).toBe(true);
  });

  it("allows events newer than the last applied Stripe event", () => {
    const lastApplied = new Date(1_700_000_000 * 1000);
    expect(isStaleStripeEvent(1_700_000_001, lastApplied)).toBe(false);
  });

  it("an older subscription event does not regress state when applied after a newer one", () => {
    const newerCreated = 1_700_000_100;
    const olderCreated = 1_700_000_000;

    let subscriptionStatus = "active";
    let lastStripeEventAt: Date | null = null;

    const applyIfFresh = (eventCreated: number, nextStatus: string) => {
      if (isStaleStripeEvent(eventCreated, lastStripeEventAt)) {
        return;
      }
      subscriptionStatus = nextStatus;
      lastStripeEventAt = new Date(eventCreated * 1000);
    };

    // Newer event processed first (e.g. won the advisory lock).
    applyIfFresh(newerCreated, "canceled");
    // Older event arrives later — must not regress to active.
    applyIfFresh(olderCreated, "active");

    expect(subscriptionStatus).toBe("canceled");
    expect(lastStripeEventAt).toEqual(new Date(newerCreated * 1000));
  });
});
