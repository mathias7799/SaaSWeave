import type Stripe from "stripe";

import {
  acquireStripeCustomerAdvisoryXactLock,
  db,
  getLastStripeEventAtForCustomer,
  isStaleStripeEvent,
  setLastStripeEventAtForCustomer
} from "@saasweave/db";

import {
  applyStripeWebhookEvent,
  claimStripeWebhookEvent,
  extractStripeCustomerId,
  type StripeWebhookApplyResult
} from "#@/stripe/webhook-apply";

export type { StripeWebhookApplyResult };

async function applyOrderedStripeWebhookEvent(
  event: Stripe.Event,
  manageUrl: string
): Promise<StripeWebhookApplyResult> {
  if (!(await claimStripeWebhookEvent(event))) return {};

  const customerId = extractStripeCustomerId(event);
  if (!customerId) {
    return applyStripeWebhookEvent(event, db, { manageUrl });
  }

  const eventAt = new Date(event.created * 1000);

  return db.transaction(async (tx) => {
    await acquireStripeCustomerAdvisoryXactLock(customerId, tx);

    const lastAppliedAt = await getLastStripeEventAtForCustomer(customerId, tx);
    if (isStaleStripeEvent(event.created, lastAppliedAt)) {
      return {};
    }

    const result = await applyStripeWebhookEvent(event, tx, { manageUrl });
    await setLastStripeEventAtForCustomer(customerId, eventAt, tx);
    return result;
  });
}

export async function processQueuedStripeWebhook(
  data: {
    eventId: string;
    type: string;
    payload: string;
  },
  manageUrl: string
): Promise<StripeWebhookApplyResult> {
  const event = JSON.parse(data.payload) as Stripe.Event;
  return applyOrderedStripeWebhookEvent(event, manageUrl);
}

export async function applyStripeWebhookInline(
  event: Stripe.Event,
  manageUrl: string
): Promise<StripeWebhookApplyResult> {
  return applyOrderedStripeWebhookEvent(event, manageUrl);
}
