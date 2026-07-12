import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { WEBHOOK_EVENTS, buildWebhookPayload } from "@saasweave/core/webhooks";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  deliverWebhookHttp,
  getWebhookEndpoint,
  listWebhookDeliveries,
  listWebhookEndpoints,
  setWebhookEndpointEnabled
} from "@saasweave/db";

import { canManageApiKeys } from "#@/lib/console-access";
import { requireFeature } from "#@/lib/procedures/factory";

const webhooksProcedure = requireFeature("webhooks");

function assertCanManageWebhooks(role: string) {
  if (!canManageApiKeys(role)) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have access to webhooks." });
  }
}

export const webhooksRouter = {
  list: webhooksProcedure
    .route({ description: "Outbound webhook endpoints for this workspace", method: "GET" })
    .handler(({ context }) => listWebhookEndpoints(context.organization.id)),

  create: webhooksProcedure
    .route({
      description: "Register a webhook endpoint. The signing secret is returned once.",
      method: "POST"
    })
    .errors({ INVALID_URL: { description: "Webhook URL is not allowed", status: 400 } })
    .input(
      z.object({
        events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
        url: z.string().url()
      })
    )
    .handler(async ({ context, errors, input }) => {
      assertCanManageWebhooks(context.organization.role);
      try {
        return await createWebhookEndpoint({
          events: input.events,
          organizationId: context.organization.id,
          url: input.url
        });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === "invalid_webhook_url" || error.message === "blocked_webhook_url")
        ) {
          throw errors.INVALID_URL();
        }
        throw error;
      }
    }),

  setEnabled: webhooksProcedure
    .route({ description: "Enable or disable a webhook endpoint", method: "POST" })
    .errors({ NOT_FOUND: { description: "Webhook not found", status: 404 } })
    .input(z.object({ enabled: z.boolean(), id: z.string().min(1) }))
    .handler(async ({ context, errors, input }) => {
      assertCanManageWebhooks(context.organization.role);
      const updated = await setWebhookEndpointEnabled(
        context.organization.id,
        input.id,
        input.enabled
      );
      if (!updated) throw errors.NOT_FOUND();
      return { ok: true };
    }),

  delete: webhooksProcedure
    .route({ description: "Delete a webhook endpoint", method: "POST" })
    .errors({ NOT_FOUND: { description: "Webhook not found", status: 404 } })
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, errors, input }) => {
      assertCanManageWebhooks(context.organization.role);
      const deleted = await deleteWebhookEndpoint(context.organization.id, input.id);
      if (!deleted) throw errors.NOT_FOUND();
      return { ok: true };
    }),

  deliveries: webhooksProcedure
    .route({ description: "Recent delivery attempts for a webhook endpoint", method: "GET" })
    .input(z.object({ endpointId: z.string().min(1) }))
    .handler(({ context, input }) =>
      listWebhookDeliveries(context.organization.id, input.endpointId)
    ),

  sendTest: webhooksProcedure
    .route({ description: "Send a test payload to a webhook endpoint", method: "POST" })
    .errors({ NOT_FOUND: { description: "Webhook not found", status: 404 } })
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, errors, input }) => {
      assertCanManageWebhooks(context.organization.role);
      const endpoint = await getWebhookEndpoint(context.organization.id, input.id);
      if (!endpoint) throw errors.NOT_FOUND();

      const result = await deliverWebhookHttp({
        endpointId: endpoint.id,
        payload: buildWebhookPayload(context.organization.id, "usage.recorded", { test: true }),
        secret: endpoint.secret,
        url: endpoint.url
      });
      return { ok: result.ok, responseStatus: result.responseStatus };
    })
};
