import { eq, sql } from "drizzle-orm";

import { db } from "#@/connection";
import { organization } from "#@/schema/auth.schema";
import { stripeCustomerAdvisoryLockKeys } from "#@/stripe-webhook-ordering";

type DbExecutor = Pick<typeof db, "execute" | "select" | "update">;

export async function acquireStripeCustomerAdvisoryXactLock(
  customerId: string,
  executor: DbExecutor
): Promise<void> {
  const [key1, key2] = stripeCustomerAdvisoryLockKeys(customerId);
  await executor.execute(sql`SELECT pg_advisory_xact_lock(${key1}, ${key2})`);
}

export async function getLastStripeEventAtForCustomer(
  customerId: string,
  executor: DbExecutor = db
): Promise<Date | null> {
  const rows = await executor
    .select({ lastStripeEventAt: organization.lastStripeEventAt })
    .from(organization)
    .where(eq(organization.stripeCustomerId, customerId))
    .limit(1);
  return rows[0]?.lastStripeEventAt ?? null;
}

export async function setLastStripeEventAtForCustomer(
  customerId: string,
  at: Date,
  executor: DbExecutor = db
): Promise<void> {
  await executor
    .update(organization)
    .set({ lastStripeEventAt: at })
    .where(eq(organization.stripeCustomerId, customerId));
}
