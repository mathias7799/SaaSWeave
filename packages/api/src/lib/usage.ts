import { randomUUID } from "node:crypto";

import { and, eq, gte, sql } from "drizzle-orm";

import { cacheInvalidateTag } from "@saasweave/cache";
import { db } from "@saasweave/db";
import { usageEvent } from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";

import { getOrgBilling, getStripe, isStripeEnabled } from "#@/lib/stripe";

/** Metrics that can be metered. Keep in sync with the billing meters. */
export const USAGE_METRICS = ["ai_tokens", "api_calls"] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

export type UsageAttribution = {
  feature?: string;
  inputTokens?: number;
  model?: string;
  outputTokens?: number;
  provider?: string;
};

function meterMap(): Record<string, string> {
  try {
    return JSON.parse(ENV_SERVER.STRIPE_METERS) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Record a unit of metered usage for an organization. This is the integration
 * point product/server code calls when it consumes billable resources. The
 * event is always persisted; when Stripe is configured and a meter is mapped
 * for the metric, it is also reported to the Stripe billing meter.
 */
export async function recordUsage(
  organizationId: string,
  metric: UsageMetric,
  quantity: number,
  attribution?: UsageAttribution
): Promise<void> {
  await db.insert(usageEvent).values({
    createdAt: new Date(),
    feature: attribution?.feature,
    id: randomUUID(),
    inputTokens: attribution?.inputTokens,
    metric,
    model: attribution?.model,
    organizationId,
    outputTokens: attribution?.outputTokens,
    provider: attribution?.provider,
    quantity
  });
  await cacheInvalidateTag(`organization:${organizationId}:usage`);

  const eventName = meterMap()[metric];
  if (!isStripeEnabled() || !eventName) return;

  const org = await getOrgBilling(organizationId);
  if (!org?.stripeCustomerId) return;

  await getStripe().billing.meterEvents.create({
    event_name: eventName,
    payload: { stripe_customer_id: org.stripeCustomerId, value: String(quantity) }
  });
}

/** Sum recorded usage per metric for an organization since a given date. */
export async function getUsageTotals(
  organizationId: string,
  since: Date
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      metric: usageEvent.metric,
      total: sql<number>`coalesce(sum(${usageEvent.quantity}), 0)::int`
    })
    .from(usageEvent)
    .where(and(eq(usageEvent.organizationId, organizationId), gte(usageEvent.createdAt, since)))
    .groupBy(usageEvent.metric);

  return Object.fromEntries(rows.map((row) => [row.metric, Number(row.total)]));
}
