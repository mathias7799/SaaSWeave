import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { OUTBOUND_HTTP_LIMITS } from "@saasweave/core/security";
import { type WebhookEvent, type WebhookPayload } from "@saasweave/core/webhooks";
import { webhookFailuresTotal } from "@saasweave/observability";

import { db } from "#@/connection";
import {
  assertPublicWebhookUrl,
  hardenedOutboundRequest,
  toSanitizedOutboundFailure
} from "#@/outbound-http";
import { webhookDelivery, webhookEndpoint } from "#@/schema/webhook.schema";

export type WebhookEndpointSummary = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
};

export type WebhookDeliveryEntry = {
  id: string;
  eventType: string;
  status: string;
  responseStatus: string | null;
  createdAt: string;
};

export type WebhookDeliveryResult = {
  failureCode?: string;
  ok: boolean;
  responseBody: string;
  responseStatus: number;
  truncated?: boolean;
};

const WEBHOOK_SENSITIVE_HEADERS = ["x-saasweave-signature", "x-saasweave-event"];

function generateSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export function signWebhookPayload(secret: string, body: string, timestamp: number): string {
  const payload = `${timestamp}.${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function listWebhookEndpoints(
  organizationId: string
): Promise<WebhookEndpointSummary[]> {
  const rows = await db
    .select()
    .from(webhookEndpoint)
    .where(eq(webhookEndpoint.organizationId, organizationId))
    .orderBy(desc(webhookEndpoint.createdAt));

  return rows.map((row) => {
    return {
      createdAt: row.createdAt.toISOString(),
      enabled: row.enabled,
      events: row.events,
      id: row.id,
      url: row.url
    };
  });
}

export async function createWebhookEndpoint(input: {
  organizationId: string;
  url: string;
  events: string[];
}): Promise<{ id: string; secret: string }> {
  await assertPublicWebhookUrl(input.url);
  const id = randomUUID();
  const secret = generateSecret();
  await db.insert(webhookEndpoint).values({
    createdAt: new Date(),
    enabled: true,
    events: input.events,
    id,
    organizationId: input.organizationId,
    secret,
    url: input.url
  });
  return { id, secret };
}

export async function setWebhookEndpointEnabled(
  organizationId: string,
  id: string,
  enabled: boolean
): Promise<boolean> {
  const rows = await db
    .update(webhookEndpoint)
    .set({ enabled })
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.organizationId, organizationId)))
    .returning({ id: webhookEndpoint.id });
  return rows.length > 0;
}

export async function deleteWebhookEndpoint(organizationId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(webhookEndpoint)
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.organizationId, organizationId)))
    .returning({ id: webhookEndpoint.id });
  return rows.length > 0;
}

export async function listWebhookDeliveries(
  organizationId: string,
  endpointId: string,
  limit = 20
): Promise<WebhookDeliveryEntry[]> {
  const rows = await db
    .select({
      createdAt: webhookDelivery.createdAt,
      eventType: webhookDelivery.eventType,
      id: webhookDelivery.id,
      responseStatus: webhookDelivery.responseStatus,
      status: webhookDelivery.status
    })
    .from(webhookDelivery)
    .innerJoin(webhookEndpoint, eq(webhookDelivery.endpointId, webhookEndpoint.id))
    .where(
      and(
        eq(webhookEndpoint.organizationId, organizationId),
        eq(webhookDelivery.endpointId, endpointId)
      )
    )
    .orderBy(desc(webhookDelivery.createdAt))
    .limit(limit);

  return rows.map((row) => {
    return {
      createdAt: row.createdAt.toISOString(),
      eventType: row.eventType,
      id: row.id,
      responseStatus: row.responseStatus,
      status: row.status
    };
  });
}

export async function getEnabledWebhookTargets(
  organizationId: string,
  event: WebhookEvent
): Promise<Array<{ endpointId: string; secret: string; url: string }>> {
  const rows = await db
    .select({
      endpointId: webhookEndpoint.id,
      events: webhookEndpoint.events,
      secret: webhookEndpoint.secret,
      url: webhookEndpoint.url
    })
    .from(webhookEndpoint)
    .where(
      and(eq(webhookEndpoint.organizationId, organizationId), eq(webhookEndpoint.enabled, true))
    );

  return rows
    .filter((row) => row.events.includes(event))
    .map((row) => {
      return {
        endpointId: row.endpointId,
        secret: row.secret,
        url: row.url
      };
    });
}

export async function getWebhookEndpoint(
  organizationId: string,
  id: string
): Promise<{ id: string; secret: string; url: string; events: string[] } | null> {
  const rows = await db
    .select({
      events: webhookEndpoint.events,
      id: webhookEndpoint.id,
      secret: webhookEndpoint.secret,
      url: webhookEndpoint.url
    })
    .from(webhookEndpoint)
    .where(and(eq(webhookEndpoint.id, id), eq(webhookEndpoint.organizationId, organizationId)))
    .limit(1);
  return rows[0] ?? null;
}

function formatStoredResponseBody(body: string, truncated: boolean): string {
  if (!truncated) return body;
  return `${body}[truncated]`;
}

export async function recordWebhookDelivery(input: {
  endpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: "delivered" | "failed";
  responseStatus?: number | null;
  responseBody?: string | null;
}): Promise<void> {
  if (input.status === "failed") webhookFailuresTotal.inc();
  await db.insert(webhookDelivery).values({
    attempt: "1",
    createdAt: new Date(),
    endpointId: input.endpointId,
    eventType: input.eventType,
    id: randomUUID(),
    payload: input.payload,
    responseBody: input.responseBody ?? null,
    responseStatus: input.responseStatus?.toString() ?? null,
    status: input.status
  });
}

export async function deliverWebhookHttp(input: {
  endpointId: string;
  secret: string;
  url: string;
  payload: WebhookPayload;
}): Promise<WebhookDeliveryResult> {
  const body = JSON.stringify(input.payload);
  if (Buffer.byteLength(body, "utf8") > OUTBOUND_HTTP_LIMITS.MAX_REQUEST_BODY_BYTES) {
    const failure = toSanitizedOutboundFailure(new Error("payload_too_large"));
    await recordWebhookDelivery({
      endpointId: input.endpointId,
      eventType: input.payload.event,
      payload: input.payload as unknown as Record<string, unknown>,
      responseBody: failure.message,
      responseStatus: null,
      status: "failed"
    });
    return {
      failureCode: failure.code,
      ok: false,
      responseBody: failure.message,
      responseStatus: 0
    };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(input.secret, body, timestamp);

  try {
    const response = await hardenedOutboundRequest({
      body,
      headers: {
        "Content-Type": "application/json",
        "X-SaaSWeave-Signature": `t=${timestamp},v1=${signature}`,
        "X-SaaSWeave-Event": input.payload.event
      },
      method: "POST",
      sensitiveHeaders: WEBHOOK_SENSITIVE_HEADERS,
      url: input.url
    });

    const responseBody = formatStoredResponseBody(response.body, response.truncated);
    const ok = response.status >= 200 && response.status < 300;
    await recordWebhookDelivery({
      endpointId: input.endpointId,
      eventType: input.payload.event,
      payload: input.payload as unknown as Record<string, unknown>,
      responseBody,
      responseStatus: response.status,
      status: ok ? "delivered" : "failed"
    });
    return {
      ok,
      responseBody,
      responseStatus: response.status,
      truncated: response.truncated
    };
  } catch (error) {
    const failure = toSanitizedOutboundFailure(error);
    await recordWebhookDelivery({
      endpointId: input.endpointId,
      eventType: input.payload.event,
      payload: input.payload as unknown as Record<string, unknown>,
      responseBody: failure.message,
      responseStatus: null,
      status: "failed"
    });
    return {
      failureCode: failure.code,
      ok: false,
      responseBody: failure.message,
      responseStatus: 0
    };
  }
}
