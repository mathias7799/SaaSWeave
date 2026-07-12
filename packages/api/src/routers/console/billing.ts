import { isFeatureEnabledForOrg } from "#@/lib/features";
import { getOrgSeatContext } from "#@/lib/organization";
import { getOrgBilling, isStripeEnabled } from "#@/lib/stripe";
import { fetchStripeBillingDetails } from "#@/lib/stripe-billing";
import { getUsageTotals } from "#@/lib/usage";
import { buildBilling, type BillingResponse } from "#@/routers/console/data";

export type BillingSummary = BillingResponse & {
  annualBillingEnabled: boolean;
  meteredLive: boolean;
  stripeEnabled: boolean;
};

const KNOWN_STATUSES = ["active", "trialing", "past_due", "canceled"] as const;

function normalizeStatus(status: string | null): BillingResponse["subscription"]["status"] {
  return (KNOWN_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as BillingResponse["subscription"]["status"])
    : "canceled";
}

/**
 * Billing view for the active organization. Falls back to sample data so the
 * console looks complete without Stripe; when Stripe is configured and the org
 * has a subscription, the real (webhook-populated) subscription state is used.
 */
export async function getBillingSummary(organizationId: string): Promise<BillingSummary> {
  const annualBillingEnabled = await isFeatureEnabledForOrg(organizationId, "annual_billing");
  // Real recorded usage for the current 30-day window, if any.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const [usageTotals, seat] = await Promise.all([
    getUsageTotals(organizationId, since),
    getOrgSeatContext(organizationId)
  ]);
  const meteredLive = Object.keys(usageTotals).length > 0;

  const sample = await buildBilling(
    organizationId,
    meteredLive ? usageTotals : undefined,
    seat.seatsUsed,
    seat.planId
  );
  // Reflect the organization's real plan name.
  sample.plan = { ...sample.plan, name: seat.planName };

  if (!isStripeEnabled()) {
    return { ...sample, annualBillingEnabled, meteredLive, stripeEnabled: false };
  }

  const org = await getOrgBilling(organizationId);
  if (!org?.subscriptionStatus) {
    return { ...sample, annualBillingEnabled, meteredLive, stripeEnabled: true };
  }

  const stripeDetails = await fetchStripeBillingDetails(organizationId);
  const planName = org.planId
    ? org.planId.charAt(0).toUpperCase() + org.planId.slice(1)
    : sample.plan.name;

  return {
    ...sample,
    annualBillingEnabled,
    meteredLive,
    ...(stripeDetails?.invoices ? { invoices: stripeDetails.invoices } : {}),
    ...(stripeDetails?.paymentMethod ? { paymentMethod: stripeDetails.paymentMethod } : {}),
    plan: { ...sample.plan, name: planName },
    stripeEnabled: true,
    subscription: stripeDetails?.subscription ?? {
      interval: sample.subscription.interval,
      planId: org.planId ?? sample.subscription.planId,
      renewsOn: org.currentPeriodEnd
        ? org.currentPeriodEnd.toISOString()
        : sample.subscription.renewsOn,
      seats: sample.subscription.seats,
      startedOn: sample.subscription.startedOn,
      status: normalizeStatus(org.subscriptionStatus)
    }
  };
}
