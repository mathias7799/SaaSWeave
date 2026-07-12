import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "member.added",
  "member.removed",
  "usage.recorded",
  "api_key.created",
  "api_key.revoked",
  "subscription.updated"
] as const;

export const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const WebhookPayloadSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  data: z.record(z.string(), z.unknown()),
  event: WebhookEventSchema,
  organizationId: z.string()
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export function buildWebhookPayload(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
  createdAt = new Date().toISOString(),
  id: string = crypto.randomUUID()
): WebhookPayload {
  return { id, createdAt, data, event, organizationId };
}
