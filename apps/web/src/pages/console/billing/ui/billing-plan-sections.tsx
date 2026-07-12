import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@saasweave/ui/components/button";
import { cn } from "@saasweave/ui/lib/utils";

import { type PlansQueryResult } from "@/shared/api/get-plans.query";
import { billingMessages, consoleCommonMessages } from "@/shared/lib/console-messages";
import {
  Badge,
  formatCurrency,
  formatDate,
  formatNumber,
  Panel,
  PanelHeader,
  Segmented
} from "@/shared/ui/console-kit";

import { type useGetBillingQuery } from "@/pages/console/billing/api/get-billing.query";

import { platformConfig } from "@/config/platform.config";

type PlanRow = PlansQueryResult[number];
type BillingData = NonNullable<ReturnType<typeof useGetBillingQuery>["data"]>;

const SUBSCRIPTION_TONE = {
  active: "success",
  canceled: "neutral",
  past_due: "destructive",
  trialing: "info"
} as const;

function subscriptionStatusLabel(status: BillingData["subscription"]["status"]): string {
  switch (status) {
    case "past_due":
      return consoleCommonMessages.statusPastDue();
    case "active":
      return consoleCommonMessages.statusActive();
    case "canceled":
      return consoleCommonMessages.statusCanceled();
    case "trialing":
      return consoleCommonMessages.statusTrialing();
    default:
      return status;
  }
}

export function PlanPicker({
  annualBillingEnabled,
  currentPlanId,
  onCheckout,
  pendingPlanId,
  plans
}: {
  annualBillingEnabled: boolean;
  currentPlanId: string;
  onCheckout: (planId: string, interval: "monthly" | "annual") => void;
  pendingPlanId: string | null;
  plans: PlanRow[];
}) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const currentIndex = plans.findIndex((plan) => plan.id === currentPlanId);

  return (
    <Panel>
      <PanelHeader
        title={billingMessages.plansTitle()}
        description={billingMessages.plansDescription()}
        action={
          annualBillingEnabled ? (
            <Segmented
              ariaLabel={billingMessages.billingIntervalAria()}
              value={interval}
              onChange={setInterval}
              options={[
                { label: consoleCommonMessages.monthly(), value: "monthly" },
                {
                  label: consoleCommonMessages.annualMonthsFree({
                    months: platformConfig.annualMonthsFree
                  }),
                  value: "annual"
                }
              ]}
            />
          ) : null
        }
      />
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan, index) => {
          const isCurrent = plan.id === currentPlanId;
          const monthly =
            plan.priceMonthly === null
              ? null
              : interval === "annual"
                ? Math.round((plan.priceMonthly * (12 - platformConfig.annualMonthsFree)) / 12)
                : plan.priceMonthly;
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl border p-5",
                isCurrent
                  ? "border-brand-border ring-1 ring-brand-border/50"
                  : plan.popular
                    ? "border-brand-border/60"
                    : "border-border"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-foreground">{plan.name}</h3>
                {isCurrent ? (
                  <Badge tone="brand">{consoleCommonMessages.current()}</Badge>
                ) : plan.popular ? (
                  <Badge tone="neutral">{consoleCommonMessages.popular()}</Badge>
                ) : null}
              </div>
              <p className="mt-1 min-h-8 text-xs text-muted-foreground">{plan.tagline}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-semibold text-foreground tabular-nums">
                  {monthly === null ? consoleCommonMessages.customPrice() : formatCurrency(monthly)}
                </span>
                {monthly !== null ? (
                  <span className="text-sm text-muted-foreground">
                    {consoleCommonMessages.perMonth()}
                  </span>
                ) : null}
              </div>
              {interval === "annual" && monthly !== null ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {consoleCommonMessages.billedAnnually()}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-transparent" aria-hidden="true">
                  .
                </p>
              )}
              <ul className="mt-4 flex-1 space-y-2">
                {plan.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    {highlight}
                  </li>
                ))}
              </ul>
              <Button
                variant={isCurrent || !plan.popular ? "outline" : "default"}
                size="sm"
                className="mt-5 w-full"
                disabled={isCurrent || pendingPlanId !== null}
                onClick={() => onCheckout(plan.id, interval)}
              >
                {isCurrent
                  ? billingMessages.currentPlan()
                  : pendingPlanId === plan.id
                    ? consoleCommonMessages.redirecting()
                    : index > currentIndex
                      ? billingMessages.upgrade()
                      : plan.cta}
              </Button>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function SubscriptionHero({ data, plans }: { data: BillingData; plans: PlanRow[] }) {
  const plan = plans.find((entry) => entry.id === data.subscription.planId);
  return (
    <Panel>
      <PanelHeader title={billingMessages.subscriptionTitle()} description={plan?.tagline} />
      <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">{billingMessages.planLabel()}</p>
          <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
            {data.plan.name}
            <Badge tone={SUBSCRIPTION_TONE[data.subscription.status]}>
              {subscriptionStatusLabel(data.subscription.status)}
            </Badge>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{billingMessages.priceLabel()}</p>
          <p className="mt-1 font-medium text-foreground tabular-nums">
            {formatCurrency(data.plan.priceMonthly)}
            <span className="text-sm font-normal text-muted-foreground">
              {consoleCommonMessages.perMonth()}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{consoleCommonMessages.seats()}</p>
          <p className="mt-1 font-medium text-foreground tabular-nums">
            {formatNumber(data.subscription.seats)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{billingMessages.renewsLabel()}</p>
          <p className="mt-1 font-medium text-foreground">
            {formatDate(data.subscription.renewsOn)}
          </p>
        </div>
      </div>
    </Panel>
  );
}
