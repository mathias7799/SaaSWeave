import { createHash } from "node:crypto";

/** Namespace for pg_advisory_xact_lock key1 (distinct from the migrate CLI lock). */
export const STRIPE_CUSTOMER_ADVISORY_LOCK_NAMESPACE = 847_262_002;

/** Derive a stable two-part advisory lock key from a Stripe customer id. */
export function stripeCustomerAdvisoryLockKeys(customerId: string): [number, number] {
  const hash = createHash("sha256").update(customerId).digest();
  return [STRIPE_CUSTOMER_ADVISORY_LOCK_NAMESPACE, hash.readInt32BE(0)];
}

/** True when the Stripe event should be skipped (already superseded by a newer applied event). */
export function isStaleStripeEvent(
  eventCreatedUnixSeconds: number,
  lastAppliedAt: Date | null | undefined
): boolean {
  if (!lastAppliedAt) return false;
  return eventCreatedUnixSeconds * 1000 <= lastAppliedAt.getTime();
}
