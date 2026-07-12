import type Stripe from "stripe";

import {
  applyStripeWebhookInline,
  processQueuedStripeWebhook,
  type StripeWebhookApplyResult
} from "@saasweave/app/stripe/webhook-process";
import { ENV_SERVER } from "@saasweave/env/server/env";

import { dispatchTemplateEmail } from "#@/dispatch";

async function deliverStripeWebhookSideEffects(result: StripeWebhookApplyResult): Promise<void> {
  const email = result.subscriptionCreatedEmail;
  if (!email) return;

  await dispatchTemplateEmail({
    key: "subscription",
    meta: { organizationId: email.organizationId },
    to: email.ownerEmail,
    values: {
      manageUrl: email.manageUrl,
      name: email.ownerName,
      planName: email.planName
    }
  });
}

function billingManageUrl(): string {
  return `${ENV_SERVER.VITE_WEB_URL}/app/billing`;
}

export async function processQueuedStripeWebhookJob(data: {
  eventId: string;
  type: string;
  payload: string;
}): Promise<void> {
  const result = await processQueuedStripeWebhook(data, billingManageUrl());
  await deliverStripeWebhookSideEffects(result);
}

export async function applyStripeWebhookJob(event: Stripe.Event): Promise<void> {
  const result = await applyStripeWebhookInline(event, billingManageUrl());
  await deliverStripeWebhookSideEffects(result);
}
