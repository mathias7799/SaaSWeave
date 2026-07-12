import type Stripe from "stripe";

import { isRedisEnabled } from "@saasweave/cache";
import { enqueueStripeWebhook } from "@saasweave/jobs/queues";
import { applyStripeWebhookJob } from "@saasweave/jobs/stripe-webhook";
import { createLogger } from "@saasweave/logger/server";

const log = createLogger({ operation: "server__stripe_dispatch" });

export async function dispatchStripeWebhook(event: Stripe.Event): Promise<void> {
  try {
    if (isRedisEnabled()) {
      await enqueueStripeWebhook({
        eventId: event.id,
        payload: JSON.stringify(event),
        type: event.type
      });
      return;
    }
    await applyStripeWebhookJob(event);
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      event: "stripe_webhook_dispatch_failed",
      stripeEventId: event.id,
      stripeEventType: event.type
    });
    throw error;
  }
}

export { processQueuedStripeWebhookJob as processQueuedStripeWebhook } from "@saasweave/jobs/stripe-webhook";
