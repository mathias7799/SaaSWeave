import { eq } from "drizzle-orm";
import Stripe from "stripe";

import {
  applyStripeWebhookEvent,
  claimStripeWebhookEvent,
  extractStripeCustomerId
} from "@saasweave/app/stripe/webhook-apply";
import { db } from "@saasweave/db";
import { organization } from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { applyStripeWebhookJob } from "@saasweave/jobs/stripe-webhook";

import { getPlatformSettings } from "#@/lib/settings";

const TRIAL_PERIOD_DAYS = 14;

/**
 * Key-optional Stripe integration. With no STRIPE_SECRET_KEY the console runs in
 * sample-billing mode; set a (test) key to activate live subscriptions,
 * the customer portal, and webhook-driven subscription state. Billing is scoped
 * to the organization (Stripe customer per org).
 */

export type BillingInterval = "monthly" | "annual";

export function isStripeEnabled(): boolean {
  return ENV_SERVER.STRIPE_SECRET_KEY.length > 0;
}

let cached: Stripe | null = null;
export function getStripe(): Stripe {
  if (!isStripeEnabled()) throw new Error("Stripe is not configured");
  cached ??= new Stripe(ENV_SERVER.STRIPE_SECRET_KEY, { typescript: true });
  return cached;
}

type PriceMap = Record<string, Partial<Record<BillingInterval, string>>>;

function priceMap(): PriceMap {
  try {
    return JSON.parse(ENV_SERVER.STRIPE_PRICES) as PriceMap;
  } catch {
    return {};
  }
}

export function priceFor(planId: string, interval: BillingInterval): string | undefined {
  return priceMap()[planId]?.[interval];
}

type OrgBillingRow = {
  id: string;
  name: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
};

export async function getOrgBilling(organizationId: string): Promise<OrgBillingRow | undefined> {
  const rows = await db
    .select({
      cancelAtPeriodEnd: organization.cancelAtPeriodEnd,
      currentPeriodEnd: organization.currentPeriodEnd,
      id: organization.id,
      name: organization.name,
      planId: organization.planId,
      stripeCustomerId: organization.stripeCustomerId,
      stripeSubscriptionId: organization.stripeSubscriptionId,
      subscriptionStatus: organization.subscriptionStatus
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  return rows[0];
}

/** Ensure the organization has a Stripe customer, creating one on first use. */
async function ensureCustomer(org: OrgBillingRow): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    metadata: { organizationId: org.id },
    name: org.name
  });
  await db
    .update(organization)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organization.id, org.id));
  return customer.id;
}

export async function createCheckoutSession(input: {
  organizationId: string;
  planId: string;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const org = await getOrgBilling(input.organizationId);
  if (!org) throw new Error("Organization not found");
  const price = priceFor(input.planId, input.interval);
  if (!price) throw new Error(`No Stripe price configured for ${input.planId}/${input.interval}`);

  const stripe = getStripe();
  const customerId = await ensureCustomer(org);
  const { trialsEnabled } = await getPlatformSettings();
  const session = await stripe.checkout.sessions.create({
    cancel_url: input.cancelUrl,
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    mode: "subscription",
    subscription_data: {
      metadata: { organizationId: org.id, planId: input.planId },
      ...(trialsEnabled ? { trial_period_days: TRIAL_PERIOD_DAYS } : {})
    },
    success_url: input.successUrl
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(input: {
  organizationId: string;
  returnUrl: string;
}): Promise<string> {
  const org = await getOrgBilling(input.organizationId);
  if (!org) throw new Error("Organization not found");
  const stripe = getStripe();
  const customerId = await ensureCustomer(org);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: input.returnUrl
  });
  return session.url;
}

// #region Webhook

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(rawBody, signature, ENV_SERVER.STRIPE_WEBHOOK_SECRET);
}

export { applyStripeWebhookEvent, claimStripeWebhookEvent, extractStripeCustomerId };

/** Update organization billing state from a Stripe webhook event. */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  await applyStripeWebhookJob(event);
}
