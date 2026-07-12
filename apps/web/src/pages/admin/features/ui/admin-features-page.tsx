import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { type FeatureCategory, PLANNED_FEATURES } from "@saasweave/core/features";

import { useGetPlansQuery } from "@/shared/api/get-plans.query";
import {
  Badge,
  ConsoleErrorState,
  ConsoleSkeleton,
  formatNumber,
  Panel,
  PanelHeader,
  SectionHeading,
  Switch
} from "@/shared/ui/console-kit";

import {
  type AdminFeature,
  featuresQueryKeys,
  useGetFeaturesQuery
} from "@/pages/admin/features/api/get-features.query";
import { useToggleFeatureMutation } from "@/pages/admin/features/api/toggle-feature.mutation";
import { useUpdateFeatureRolloutMutation } from "@/pages/admin/features/api/update-feature-rollout.mutation";

const CATEGORY_ORDER: FeatureCategory[] = ["Core", "AI", "Collaboration", "Security", "Billing"];

function RolloutInput({ feature }: { feature: AdminFeature }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(feature.rollout ?? 0));
  const mutation = useUpdateFeatureRolloutMutation({
    onError: (error) => toast.error(error.message || "Failed to update rollout"),
    onSuccess: () => {
      toast.success(`${feature.name} rollout updated`);
      void queryClient.invalidateQueries({ queryKey: featuresQueryKeys.all() });
    }
  });

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      Rollout
      <input
        aria-label={`Rollout percentage for ${feature.name}`}
        className="w-14 rounded-md border border-input bg-background px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={mutation.isPending}
        max={100}
        min={0}
        onBlur={() => {
          const next = Math.min(100, Math.max(0, Number(value) || 0));
          if (next !== (feature.rollout ?? 0)) {
            mutation.mutate({ key: feature.key, rollout: next });
          }
        }}
        onChange={(event) => setValue(event.target.value)}
        type="number"
        value={value}
      />
      %
    </label>
  );
}

function FeatureRow({ feature }: { feature: AdminFeature }) {
  const queryClient = useQueryClient();
  const plansQuery = useGetPlansQuery();
  const staged = typeof feature.rollout === "number" && feature.rollout < 100;

  const toggle = useToggleFeatureMutation({
    onError: (error) => toast.error(error.message || "Failed to update feature"),
    onSuccess: () => {
      toast.success(`${feature.name} ${feature.enabled ? "disabled" : "enabled"}`);
      void queryClient.invalidateQueries({ queryKey: featuresQueryKeys.all() });
    }
  });

  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{feature.name}</span>
          {staged ? <Badge tone="warning">Rollout {feature.rollout}%</Badge> : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{feature.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {formatNumber(feature.stats.requests30d)} tracked requests ·{" "}
            {formatNumber(feature.stats.workspacesEnabled)} of{" "}
            {formatNumber(feature.stats.totalWorkspaces)} workspaces ({feature.stats.adoptionPct}%
            adoption)
          </span>
          <span className="flex items-center gap-1">
            {feature.availableOn.map((planId) => {
              const plan = plansQuery.data?.find((entry) => entry.id === planId);
              return (
                <span
                  key={planId}
                  className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {plan?.name ?? planId}
                </span>
              );
            })}
          </span>
          {staged ? <RolloutInput feature={feature} /> : null}
        </div>
      </div>
      <div className="pt-0.5">
        <Switch
          checked={feature.enabled}
          disabled={toggle.isPending}
          label={`Toggle ${feature.name}`}
          onChange={(next) => toggle.mutate({ enabled: next, key: feature.key })}
        />
      </div>
    </div>
  );
}

function PlannedFeatureRow({ feature }: { feature: (typeof PLANNED_FEATURES)[number] }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 opacity-90">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{feature.name}</span>
          <Badge tone="neutral">Planned</Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{feature.description}</p>
      </div>
    </div>
  );
}

export function AdminFeaturesPage() {
  const query = useGetFeaturesQuery();

  if (query.isError) {
    return (
      <ConsoleErrorState
        description="Couldn't load the feature catalog."
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <ConsoleSkeleton />;

  const { features } = query.data;
  const categories = CATEGORY_ORDER.filter((category) =>
    features.some((feature) => feature.category === category)
  );
  const enabledCount = features.filter((feature) => feature.enabled).length;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform"
        title="Platform features"
        description="Turn workspace capabilities on or off platform-wide — API keys, webhooks, audit logs, AI, SSO, and billing add-ons."
        action={
          <Badge tone="neutral">
            {enabledCount} of {features.length} enabled
          </Badge>
        }
      />

      {categories.map((category) => {
        const categoryFeatures = features.filter((feature) => feature.category === category);
        return (
          <Panel key={category}>
            <PanelHeader title={category} />
            <div className="divide-y divide-border">
              {categoryFeatures.map((feature) => (
                <FeatureRow feature={feature} key={feature.key} />
              ))}
            </div>
          </Panel>
        );
      })}

      {PLANNED_FEATURES.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Planned capabilities"
            description="Not shipped yet — listed for roadmap visibility only."
          />
          <div className="divide-y divide-border">
            {PLANNED_FEATURES.map((feature) => (
              <PlannedFeatureRow feature={feature} key={feature.key} />
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
