import { Coins, Sparkles, Timer, Zap } from "lucide-react";

import { aiUsageMessages, consoleCommonMessages } from "@/shared/lib/console-messages";
import { DonutChart, StackedBarChart } from "@/shared/ui/charts";
import {
  ConsoleSkeleton,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  LegendDot,
  Panel,
  PanelHeader,
  SectionHeading,
  StatTile
} from "@/shared/ui/console-kit";

import { useGetAiUsageQuery } from "@/pages/console/ai-usage/api/get-ai-usage.query";

const MODEL_COLORS = [
  "var(--brand)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)"
];

export function AiUsagePage() {
  const query = useGetAiUsageQuery();

  if (!query.data) return <ConsoleSkeleton />;
  const data = query.data;

  const outputRatio = data.totals.tokens > 0 ? data.totals.outputTokens / data.totals.tokens : 0;
  const dailyValues = data.daily.map((point) => {
    const output = Math.round(point.tokens * outputRatio);
    return [point.tokens - output, output];
  });

  const donutSlices = data.byModel.map((model, index) => {
    return {
      color: MODEL_COLORS[index % MODEL_COLORS.length],
      key: model.model,
      label: model.model,
      value: model.inputTokens + model.outputTokens
    };
  });

  const maxFeatureTokens = Math.max(...data.byFeature.map((feature) => feature.tokens), 1);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={consoleCommonMessages.aiUsageEyebrow()}
        title={aiUsageMessages.title()}
        description={aiUsageMessages.description()}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label={aiUsageMessages.tokensProcessed()}
          value={formatCompact(data.totals.tokens)}
          icon={Sparkles}
        />
        <StatTile
          label={aiUsageMessages.aiRequests()}
          value={formatCompact(data.totals.requests)}
          icon={Zap}
        />
        <StatTile
          label={aiUsageMessages.estimatedCost()}
          value={formatCurrency(data.totals.cost, true)}
          icon={Coins}
        />
        <StatTile
          label={aiUsageMessages.avgLatency()}
          value={aiUsageMessages.avgLatencyValue({
            value: formatNumber(data.totals.avgLatencyMs)
          })}
          icon={Timer}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title={aiUsageMessages.dailyThroughputTitle()}
            description={aiUsageMessages.dailyThroughputDescription()}
            action={
              <div className="flex items-center gap-3">
                <LegendDot color="var(--chart-3)" label={consoleCommonMessages.input()} />
                <LegendDot color="var(--brand)" label={consoleCommonMessages.output()} />
              </div>
            }
          />
          <div className="p-4 sm:p-5">
            <StackedBarChart
              ariaLabel={aiUsageMessages.chartAriaDaily()}
              labels={data.daily.map((point) => point.label)}
              values={dailyValues}
              segments={[
                { color: "var(--chart-3)", key: "input", label: consoleCommonMessages.input() },
                { color: "var(--brand)", key: "output", label: consoleCommonMessages.output() }
              ]}
            />
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <PanelHeader title={aiUsageMessages.tokensByModelTitle()} />
          <div className="flex flex-1 flex-col items-center gap-5 p-5">
            <DonutChart
              slices={donutSlices}
              centerValue={formatCompact(data.totals.tokens)}
              centerLabel={aiUsageMessages.totalTokensCenter()}
            />
            <ul className="w-full space-y-2">
              {data.byModel.map((model, index) => (
                <li key={model.model} className="flex items-center justify-between gap-3 text-sm">
                  <LegendDot
                    color={MODEL_COLORS[index % MODEL_COLORS.length]}
                    label={model.model}
                  />
                  <span className="text-muted-foreground tabular-nums">
                    {formatPercent(
                      data.totals.tokens > 0
                        ? ((model.inputTokens + model.outputTokens) / data.totals.tokens) * 100
                        : 0,
                      0
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelHeader
            title={aiUsageMessages.usageByModelTitle()}
            description={aiUsageMessages.usageByModelDescription()}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3 font-medium">{consoleCommonMessages.model()}</th>
                  <th className="px-5 py-3 text-right font-medium">
                    {consoleCommonMessages.requests()}
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    {consoleCommonMessages.tokens()}
                  </th>
                  <th className="px-5 py-3 text-right font-medium">
                    {consoleCommonMessages.cost()}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.byModel.map((model) => (
                  <tr key={model.model} className="transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{model.model}</div>
                      <div className="text-xs text-muted-foreground">{model.provider}</div>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                      {formatCompact(model.requests)}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                      {formatCompact(model.inputTokens + model.outputTokens)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums">
                      {formatCurrency(model.cost, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader
            title={aiUsageMessages.topFeaturesTitle()}
            description={aiUsageMessages.topFeaturesDescription()}
          />
          <ul className="space-y-4 p-5">
            {data.byFeature.slice(0, 6).map((feature) => (
              <li key={feature.feature}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">{feature.feature}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatCompact(feature.tokens)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(feature.tokens / maxFeatureTokens) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {aiUsageMessages.featureStats({
                    latency: formatNumber(feature.avgLatencyMs),
                    errors: formatPercent(feature.errorRatePct, 2)
                  })}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
