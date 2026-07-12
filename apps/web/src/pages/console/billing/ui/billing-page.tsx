import { CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@saasweave/ui/components/button";

import { useGetPlansQuery } from "@/shared/api/get-plans.query";
import { billingMessages, consoleCommonMessages } from "@/shared/lib/console-messages";
import { ConsoleErrorState, ConsoleSkeleton, SectionHeading } from "@/shared/ui/console-kit";

import { useCreateBillingPortalMutation } from "@/pages/console/billing/api/create-billing-portal.mutation";
import { useCreateCheckoutMutation } from "@/pages/console/billing/api/create-checkout.mutation";
import { useGetBillingQuery } from "@/pages/console/billing/api/get-billing.query";
import { PlanPicker, SubscriptionHero } from "@/pages/console/billing/ui/billing-plan-sections";
import {
  EstimateCard,
  InvoicesCard,
  InvoicingTeaser,
  MeteredUsage,
  PaymentMethodCard
} from "@/pages/console/billing/ui/billing-usage-sections";

import { platformConfig } from "@/config/platform.config";

export function BillingPage() {
  const query = useGetBillingQuery();
  const plansQuery = useGetPlansQuery();
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const checkout = useCreateCheckoutMutation({
    onMutate: (vars) => setPendingPlanId(vars.planId),
    onError: (error: Error) => {
      setPendingPlanId(null);
      toast.error(error.message);
    },
    onSuccess: (result) => {
      window.location.href = result.url;
    }
  });
  const portal = useCreateBillingPortalMutation({
    onMutate: () => setPortalPending(true),
    onError: (error: Error) => {
      setPortalPending(false);
      toast.error(error.message);
    },
    onSuccess: (result) => {
      window.location.href = result.url;
    }
  });

  if (query.isError || plansQuery.isError) {
    return (
      <ConsoleErrorState
        description={billingMessages.errorDescription()}
        onRetry={() => {
          void query.refetch();
          void plansQuery.refetch();
        }}
      />
    );
  }
  if (!query.data || !plansQuery.data) return <ConsoleSkeleton />;
  const data = query.data;
  const plans = plansQuery.data;
  const mode = platformConfig.billingMode;
  const billingLive = data.stripeEnabled;
  const sampleNotice = billingMessages.sampleNotice();
  const handleCheckout = (planId: string, interval: "monthly" | "annual") => {
    if (!billingLive) {
      toast.info(sampleNotice);
      return;
    }
    if (interval === "annual" && !data.annualBillingEnabled) {
      toast.error(billingMessages.annualNotAvailable());
      return;
    }
    checkout.mutate({ interval, planId });
  };
  const handleManage = () => {
    if (!billingLive) {
      toast.info(sampleNotice);
      return;
    }
    portal.mutate();
  };

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={consoleCommonMessages.billingEyebrow()}
        title={billingMessages.title()}
        description={billingMessages.description()}
        action={
          <Button variant="outline" onClick={handleManage} disabled={portalPending}>
            {portalPending ? consoleCommonMessages.opening() : billingMessages.manageBilling()}
          </Button>
        }
      />
      {!billingLive ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand-border/50 bg-brand-subtle/30 px-4 py-2.5 text-sm text-muted-foreground">
          <CreditCard className="size-4 shrink-0 text-brand" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">
              {billingMessages.sampleBannerTitle()}
            </span>{" "}
            {billingMessages.sampleBannerBody()}
          </span>
        </div>
      ) : null}
      {mode === "usage" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EstimateCard data={data} />
          </div>
          <PaymentMethodCard data={data} onManage={handleManage} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SubscriptionHero data={data} plans={plans} />
          </div>
          <PaymentMethodCard data={data} onManage={handleManage} />
        </div>
      )}
      {(mode === "usage" || mode === "hybrid") && <MeteredUsage data={data} />}
      {(mode === "subscription" || mode === "hybrid") && (
        <PlanPicker
          annualBillingEnabled={data.annualBillingEnabled}
          currentPlanId={data.subscription.planId}
          onCheckout={handleCheckout}
          pendingPlanId={pendingPlanId}
          plans={plans}
        />
      )}
      <InvoicingTeaser />
      <InvoicesCard data={data} />
    </div>
  );
}
