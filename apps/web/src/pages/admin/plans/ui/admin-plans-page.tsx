import { cn } from "@saasweave/ui/lib/utils";

import { useGetPlansQuery } from "@/shared/api/get-plans.query";
import {
  Badge,
  ConsoleErrorState,
  ConsoleSkeleton,
  formatCurrency,
  formatNumber,
  Panel,
  PanelHeader,
  SectionHeading
} from "@/shared/ui/console-kit";
import { PlanHighlights } from "@/shared/ui/plan-highlights";

import { useGetPlatformStatsQuery } from "@/pages/admin/api/get-platform-stats.query";
import { CreatePlanSheet, EditPlanSheet } from "@/pages/admin/plans/ui/plan-editor";

import { platformConfig } from "@/config/platform.config";

const BILLING_MODE_COPY = {
  hybrid: "A base plan plus metered usage overages.",
  subscription: "Fixed-price tiers billed on a recurring interval.",
  usage: "Pay-as-you-go, metered by consumption."
} as const;

export function AdminPlansPage() {
  const statsQuery = useGetPlatformStatsQuery();
  const plansQuery = useGetPlansQuery();
  if (statsQuery.isError || plansQuery.isError) {
    return (
      <ConsoleErrorState
        description="Couldn't load the plan catalog."
        onRetry={() => {
          void statsQuery.refetch();
          void plansQuery.refetch();
        }}
      />
    );
  }
  if (!statsQuery.data || !plansQuery.data) return <ConsoleSkeleton />;
  const statFor = (planId: string) =>
    statsQuery.data.planDistribution.find((plan) => plan.planId === planId);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform"
        title="Plans & catalog"
        description="Define what you sell and how it is priced. Every workspace reads live from this catalog."
        action={<CreatePlanSheet />}
      />
      <Panel>
        <PanelHeader
          title="Billing model"
          description="How every customer is charged across the platform"
        />
        <div className="flex flex-wrap items-center gap-3 p-5">
          {(["subscription", "usage", "hybrid"] as const).map((mode) => {
            const active = platformConfig.billingMode === mode;
            return (
              <div
                key={mode}
                className={cn(
                  "flex-1 rounded-lg border p-4 transition-colors",
                  active ? "border-brand-border bg-brand-subtle/40" : "border-border bg-background"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground capitalize">{mode}</span>
                  {active ? <Badge tone="brand">Active</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{BILLING_MODE_COPY[mode]}</p>
              </div>
            );
          })}
        </div>
      </Panel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plansQuery.data.map((plan) => {
          const stat = statFor(plan.id);
          return (
            <Panel
              key={plan.id}
              className={cn(
                "flex flex-col p-5",
                plan.popular ? "border-brand-border ring-1 ring-brand-border/50" : undefined
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-foreground">{plan.name}</h3>
                {plan.popular ? <Badge tone="brand">Popular</Badge> : null}
              </div>
              <p className="mt-1 min-h-8 text-xs text-muted-foreground">{plan.tagline}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-semibold text-foreground tabular-nums">
                  {plan.priceMonthly === null ? "Custom" : formatCurrency(plan.priceMonthly)}
                </span>
                {plan.priceMonthly !== null ? (
                  <span className="text-sm text-muted-foreground">/mo</span>
                ) : null}
              </div>
              <PlanHighlights highlights={plan.highlights} />
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Subscribers</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {stat ? formatNumber(stat.customers) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">MRR</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {stat ? formatCurrency(stat.mrr) : "—"}
                  </dd>
                </div>
              </dl>
              <EditPlanSheet plan={plan} />
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
