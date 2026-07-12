import { Building2, DollarSign, Percent, Sparkles } from "lucide-react";

import { AreaChart, DonutChart, StackedBarChart } from "@/shared/ui/charts";
import {
  ConsoleSkeleton,
  formatCompact,
  formatCurrency,
  formatMetricValue,
  formatNumber,
  LegendDot,
  Panel,
  PanelHeader,
  SectionHeading,
  StatTile
} from "@/shared/ui/console-kit";

import { useGetPlatformStatsQuery } from "@/pages/admin/api/get-platform-stats.query";

const KPI_ICONS = {
  ai_spend: Sparkles,
  mrr: DollarSign,
  nrr: Percent,
  workspaces: Building2
} as const;

const PLAN_COLORS = ["var(--brand)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function AdminAnalyticsPage() {
  const query = useGetPlatformStatsQuery();

  if (!query.data) return <ConsoleSkeleton />;
  const data = query.data;

  const planSlices = data.planDistribution.map((plan, index) => {
    return {
      color: PLAN_COLORS[index % PLAN_COLORS.length],
      key: plan.planId,
      label: plan.name,
      value: plan.mrr
    };
  });
  const totalMrr = data.planDistribution.reduce((sum, plan) => sum + plan.mrr, 0);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform"
        title="Platform analytics"
        description="Revenue, retention, and plan mix across every SaaSWeave workspace."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <StatTile
            key={kpi.key}
            label={kpi.label}
            value={formatMetricValue(kpi.value, kpi.unit)}
            delta={kpi.deltaPct}
            spark={kpi.spark}
            icon={KPI_ICONS[kpi.key as keyof typeof KPI_ICONS]}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Monthly recurring revenue"
            description={
              data.mrrTrendCollecting
                ? "Collecting history — chart shows saved monthly snapshots as they accumulate"
                : "Trailing 12 months"
            }
          />
          <div className="p-4 sm:p-5">
            <AreaChart
              ariaLabel="Monthly recurring revenue over the last 12 months"
              labels={data.mrrTrend.map((point) => point.label)}
              series={[
                {
                  color: "var(--brand)",
                  key: "mrr",
                  label: "MRR",
                  values: data.mrrTrend.map((point) => point.mrr)
                }
              ]}
              formatValue={(value) => `$${formatCompact(value)}`}
            />
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader title="MRR by plan" />
          <div className="flex flex-1 flex-col items-center gap-5 p-5">
            <DonutChart
              slices={planSlices}
              centerValue={`$${formatCompact(totalMrr)}`}
              centerLabel="total MRR"
            />
            <ul className="w-full space-y-2">
              {data.planDistribution.map((plan, index) => (
                <li key={plan.planId} className="flex items-center justify-between gap-3 text-sm">
                  <LegendDot color={PLAN_COLORS[index % PLAN_COLORS.length]} label={plan.name} />
                  <span className="text-muted-foreground tabular-nums">
                    {formatNumber(plan.customers)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="New vs. churned MRR"
            description="Monthly movement"
            action={
              <div className="flex items-center gap-3">
                <LegendDot color="var(--brand)" label="New" />
                <LegendDot color="var(--chart-4)" label="Churned" />
              </div>
            }
          />
          <div className="p-4 sm:p-5">
            <StackedBarChart
              ariaLabel="New versus churned MRR per month"
              labels={data.mrrTrend.map((point) => point.label)}
              values={data.mrrTrend.map((point) => [point.newMrr, point.churnedMrr])}
              segments={[
                { color: "var(--brand)", key: "new", label: "New" },
                { color: "var(--chart-4)", key: "churned", label: "Churned" }
              ]}
              formatValue={(value) => `$${formatCompact(value)}`}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Plan distribution"
            description={`${formatNumber(data.totalWorkspaces)} workspaces`}
          />
          <ul className="divide-y divide-border">
            {data.planDistribution.map((plan) => (
              <li key={plan.planId} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(plan.customers)} customers
                  </p>
                </div>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {formatCurrency(plan.mrr)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
