import { isRedisEnabled } from "@saasweave/cache";
import {
  type WebhookEvent,
  type WebhookPayload,
  buildWebhookPayload
} from "@saasweave/core/webhooks";
import { deliverWebhookHttp, getEnabledWebhookTargets, getWebhookEndpoint } from "@saasweave/db";
import { createLogger } from "@saasweave/logger/server";

import { enqueueWebhookDelivery } from "#@/queues";

const log = createLogger({ operation: "server__jobs_dispatch" });

/**
 * Fan out an organization webhook event to subscribed endpoints. Queues delivery
 * when Redis is configured; otherwise delivers inline in the current process.
 */
export async function dispatchOrgWebhook(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const targets = await getEnabledWebhookTargets(organizationId, event);
    if (targets.length === 0) return;

    const payload: WebhookPayload = buildWebhookPayload(organizationId, event, data);

    await Promise.all(
      targets.map(async (target) => {
        if (isRedisEnabled()) {
          await enqueueWebhookDelivery({
            endpointId: target.endpointId,
            payload,
            url: target.url
          });
          return;
        }
        await deliverWebhookHttp({
          endpointId: target.endpointId,
          payload,
          secret: target.secret,
          url: target.url
        });
      })
    );
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      event: "webhook_dispatch_failed",
      organizationId,
      webhookEvent: event
    });
  }
}

export async function processQueuedWebhookDelivery(input: {
  endpointId: string;
  payload: WebhookPayload;
  url: string;
}): Promise<void> {
  const endpoint = await getWebhookEndpoint(input.payload.organizationId, input.endpointId);
  if (!endpoint) return; // endpoint deleted since enqueue — nothing to deliver
  const result = await deliverWebhookHttp({
    endpointId: input.endpointId,
    payload: input.payload,
    secret: endpoint.secret,
    url: input.url
  });
  if (!result.ok) {
    throw new Error(`Webhook delivery failed (status ${result.responseStatus ?? "network_error"})`);
  }
}
