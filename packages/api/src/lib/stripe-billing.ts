import type Stripe from "stripe";

import { getOrgBilling, getStripe, isStripeEnabled } from "#@/lib/stripe";
import { type BillingResponse } from "#@/routers/console/data";

type StripeBillingDetails = {
  invoices: BillingResponse["invoices"];
  paymentMethod: BillingResponse["paymentMethod"];
  subscription?: BillingResponse["subscription"];
};

function mapInvoiceStatus(
  status: Stripe.Invoice.Status | null
): BillingResponse["invoices"][number]["status"] {
  if (status === "paid") return "paid";
  if (status === "open") return "open";
  return "past_due";
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export async function fetchStripeBillingDetails(
  organizationId: string
): Promise<StripeBillingDetails | null> {
  if (!isStripeEnabled()) return null;
  const org = await getOrgBilling(organizationId);
  if (!org?.stripeCustomerId) return null;

  const stripe = getStripe();
  const [invoices, customer, subscription] = await Promise.all([
    stripe.invoices.list({ customer: org.stripeCustomerId, limit: 6 }),
    stripe.customers.retrieve(org.stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"]
    }),
    org.stripeSubscriptionId
      ? stripe.subscriptions.retrieve(org.stripeSubscriptionId)
      : Promise.resolve(null)
  ]);

  const defaultPaymentMethod =
    customer.deleted || !("invoice_settings" in customer)
      ? null
      : (customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null);

  return {
    invoices: invoices.data.map((invoice) => {
      return {
        amount: round(invoice.amount_paid / 100, 2),
        id: invoice.id ?? `inv_${invoice.created}`,
        issuedOn: new Date((invoice.created ?? 0) * 1000).toISOString(),
        number: invoice.number ?? invoice.id ?? `inv_${invoice.created}`,
        status: mapInvoiceStatus(invoice.status)
      };
    }),
    paymentMethod: defaultPaymentMethod?.card
      ? {
          brand: defaultPaymentMethod.card.brand,
          expMonth: defaultPaymentMethod.card.exp_month,
          expYear: defaultPaymentMethod.card.exp_year,
          last4: defaultPaymentMethod.card.last4
        }
      : null,
    subscription: subscription
      ? {
          interval:
            subscription.items.data[0]?.price?.recurring?.interval === "year"
              ? "annual"
              : "monthly",
          planId: subscription.metadata.planId ?? org.planId ?? "starter",
          renewsOn: subscription.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : new Date().toISOString(),
          seats: subscription.items.data[0]?.quantity ?? 1,
          startedOn: new Date(subscription.start_date * 1000).toISOString(),
          status:
            subscription.status === "trialing" ||
            subscription.status === "active" ||
            subscription.status === "past_due" ||
            subscription.status === "canceled"
              ? subscription.status
              : "canceled"
        }
      : undefined
  };
}
