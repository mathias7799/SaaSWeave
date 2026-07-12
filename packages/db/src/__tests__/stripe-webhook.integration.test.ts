import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  acquireStripeCustomerAdvisoryXactLock,
  getLastStripeEventAtForCustomer,
  setLastStripeEventAtForCustomer
} from "@saasweave/db";
import { db } from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

describe.sequential("stripe-webhook", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("reads and writes last Stripe event timestamps per customer", async () => {
    const customerId = "cus_integration_test";
    await seedOrgWithOwner({ stripeCustomerId: customerId });

    expect(await getLastStripeEventAtForCustomer(customerId)).toBeNull();

    const appliedAt = new Date("2026-06-01T12:00:00.000Z");
    await setLastStripeEventAtForCustomer(customerId, appliedAt);

    const stored = await getLastStripeEventAtForCustomer(customerId);
    expect(stored?.toISOString()).toBe(appliedAt.toISOString());
  });

  it("acquires a transaction-scoped advisory lock for a customer", async () => {
    const customerId = "cus_lock_test";
    await seedOrgWithOwner({ stripeCustomerId: customerId });

    await db.transaction(async (tx) => {
      await acquireStripeCustomerAdvisoryXactLock(customerId, tx);
      await setLastStripeEventAtForCustomer(customerId, new Date("2026-07-01T00:00:00.000Z"), tx);
    });

    const stored = await getLastStripeEventAtForCustomer(customerId);
    expect(stored?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});
