import { Sparkles, Users, Wallet, Zap } from "lucide-react";

import { consoleCommonMessages, overviewMessages } from "@/shared/lib/console-messages";
import { auditIcon, auditSentence } from "@/shared/ui/audit";
import { AreaChart } from "@/shared/ui/charts";
import {
  Badge,
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleSkeleton,
  formatCompact,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  Meter,
  Panel,
  PanelHeader,
  SectionHeading,
  StatTile
} from "@/shared/ui/console-kit";

import { useGetOverviewQuery } from "@/pages/console/overview/api/get-overview.query";

const METRIC_ICONS = {
  active_users: Users,
  requests: Zap,
  revenue: Wallet,
  tokens: Sparkles
} as const;

function formatMetric(value: number, unit: string): string {
  switch (unit) {
    case "currency":
      return formatCurrency(value);
    case "tokens":
      return formatCompact(value);
    case "ms":
      return `${formatNumber(value)}ms`;
    case "percent":
      return formatPercent(value);
    default:
      return value >= 100000 ? formatCompact(value) : formatNumber(value);
  }
}

export function OverviewPage({ userName }: { userName: string }) {
  const query = useGetOverviewQuery();

  if (query.isError) {
    return (
      <ConsoleErrorState
        description={overviewMessages.errorDescription()}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <ConsoleSkeleton />;
  const data = query.data;

  const firstName = userName.split(" ")[0] || userName;
  const aiCreditFraction = data.plan.aiCreditsUsed / data.plan.aiCreditsIncluded;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={consoleCommonMessages.workspaceEyebrow()}
        title={overviewMessages.welcomeTitle({ name: firstName })}
        description={overviewMessages.description()}
        action={
          <Badge tone="success">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {overviewMessages.allSystemsOperational()}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <StatTile
            key={metric.key}
            label={metric.label}
            value={formatMetric(metric.value, metric.unit)}
            delta={metric.deltaPct}
            spark={metric.spark}
            icon={METRIC_ICONS[metric.key as keyof typeof METRIC_ICONS]}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title={overviewMessages.requestVolumeTitle()}
            description={overviewMessages.requestVolumeDescription()}
          />
          <div className="p-4 sm:p-5">
            <AreaChart
              ariaLabel={overviewMessages.chartAriaRequests()}
              labels={data.trend.map((point) => point.label)}
              series={[
                {
                  color: "var(--brand)",
                  key: "requests",
                  label: consoleCommonMessages.requests(),
                  values: data.trend.map((point) => point.requests)
                }
              ]}
            />
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader title={overviewMessages.planAllowanceTitle()} description={data.plan.name} />
          <div className="flex flex-1 flex-col justify-between gap-5 p-5">
            <div className="space-y-5">
              <Meter
                label={consoleCommonMessages.seats()}
                fraction={data.plan.seatsUsed / data.plan.seatsIncluded}
                usedLabel={overviewMessages.seatsUsed({ count: data.plan.seatsUsed })}
                includedLabel={overviewMessages.seatsIncluded({ count: data.plan.seatsIncluded })}
              />
              <Meter
                label={overviewMessages.aiCreditsLabel()}
                fraction={aiCreditFraction}
                usedLabel={overviewMessages.tokensM({ count: data.plan.aiCreditsUsed })}
                includedLabel={overviewMessages.tokensIncluded({
                  count: data.plan.aiCreditsIncluded
                })}
                note={
                  aiCreditFraction > 1
                    ? overviewMessages.overAllowanceNote()
                    : aiCreditFraction > 0.8
                      ? overviewMessages.approachingAllowanceNote()
                      : undefined
                }
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
              <span className="text-muted-foreground">{overviewMessages.renewsOnPrefix()}</span>
              <span className="font-medium text-foreground">{formatDate(data.plan.renewsOn)}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title={overviewMessages.aiTokenConsumptionTitle()}
            description={overviewMessages.aiTokenConsumptionDescription()}
          />
          <div className="p-4 sm:p-5">
            <AreaChart
              ariaLabel={overviewMessages.chartAriaTokens()}
              labels={data.trend.map((point) => point.label)}
              series={[
                {
                  color: "var(--chart-2)",
                  key: "tokens",
                  label: consoleCommonMessages.tokens(),
                  values: data.trend.map((point) => point.tokens)
                }
              ]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title={overviewMessages.recentActivityTitle()}
            description={overviewMessages.recentActivityDescription()}
          />
          {data.activity.length > 0 ? (
            <ul className="divide-y divide-border">
              {data.activity.map((item) => {
                const Icon = auditIcon(item.action);
                return (
                  <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">{auditSentence(item)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ConsoleEmptyState
              description={overviewMessages.emptyActivityDescription()}
              title={overviewMessages.emptyActivityTitle()}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
