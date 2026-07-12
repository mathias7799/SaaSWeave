/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { describe, expect } from "vite-plus/test";

import { db } from "@saasweave/db";
import { auditLog, organization } from "@saasweave/db/schema";

import {
  applyStripeWebhookEvent,
  claimStripeWebhookEvent,
  handleWebhookEvent
} from "#@/lib/stripe";

import { integrationIt, seedOrgWithOwner } from "./harness";

function subscriptionEvent(input: {
  customerId: string;
  eventId: string;
  organizationId: string;
  planId: string;
  type: Stripe.Event["type"];
}): Stripe.Event {
  return {
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        cancel_at_period_end: false,
        customer: input.customerId,
        id: "sub_integration",
        items: {
          data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86_400 }]
        },
        metadata: {
          organizationId: input.organizationId,
          planId: input.planId
        },
        status: "active"
      }
    },
    id: input.eventId,
    type: input.type
  } as unknown as Stripe.Event;
}

describe.sequential("stripe webhook handlers", () => {
  integrationIt("applyStripeWebhookEvent updates organization subscription state", async () => {
    const seed = await seedOrgWithOwner();
    const customerId = `cus_${randomUUID().slice(0, 8)}`;
    await db
      .update(organization)
      .set({ stripeCustomerId: customerId })
      .where(eq(organization.id, seed.organizationId));

    await applyStripeWebhookEvent(
      subscriptionEvent({
        customerId,
        eventId: `evt_${randomUUID()}`,
        organizationId: seed.organizationId,
        planId: "growth",
        type: "customer.subscription.updated"
      })
    );

    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, seed.organizationId))
      .limit(1);

    expect(org?.subscriptionStatus).toBe("active");
    expect(org?.planId).toBe("growth");
    expect(org?.stripeSubscriptionId).toBe("sub_integration");
  });

  integrationIt("handleWebhookEvent is idempotent per Stripe event id", async () => {
    const seed = await seedOrgWithOwner();
    const customerId = `cus_${randomUUID().slice(0, 8)}`;
    await db
      .update(organization)
      .set({ stripeCustomerId: customerId })
      .where(eq(organization.id, seed.organizationId));

    const event = subscriptionEvent({
      customerId,
      eventId: `evt_${randomUUID()}`,
      organizationId: seed.organizationId,
      planId: "scale",
      type: "customer.subscription.created"
    });

    await handleWebhookEvent(event);
    await handleWebhookEvent(event);

    expect(await claimStripeWebhookEvent(event)).toBe(false);
  });

  integrationIt("applyStripeWebhookEvent records invoice.paid audit activity", async () => {
    const seed = await seedOrgWithOwner();
    const customerId = `cus_${randomUUID().slice(0, 8)}`;
    await db
      .update(organization)
      .set({ stripeCustomerId: customerId })
      .where(eq(organization.id, seed.organizationId));

    await applyStripeWebhookEvent({
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          amount_paid: 9900,
          customer: customerId,
          id: "in_integration"
        }
      },
      id: `evt_${randomUUID()}`,
      type: "invoice.paid"
    } as unknown as Stripe.Event);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.organizationId, seed.organizationId));

    expect(rows.some((row) => row.action === "billing.invoice_paid")).toBe(true);
  });
});
