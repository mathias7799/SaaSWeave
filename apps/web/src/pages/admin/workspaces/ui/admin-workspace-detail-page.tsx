import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@saasweave/auth/react/tanstack-start/hooks";
import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { Button } from "@saasweave/ui/components/button";

import { useGetPlansQuery } from "@/shared/api/get-plans.query";
import { impersonateAndOpenConsole } from "@/shared/lib/impersonate-and-open-console";
import { auditIcon, auditSentence } from "@/shared/ui/audit";
import {
  Badge,
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleSkeleton,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
  Panel,
  PanelHeader,
  SectionHeading,
  Segmented
} from "@/shared/ui/console-kit";

import {
  useGetWorkspaceDetailQuery,
  workspaceDetailQueryKeys,
  type WorkspaceDetailQueryResult
} from "@/pages/admin/workspaces/api/get-workspace-detail.query";
import { useSetWorkspaceFeatureMutation } from "@/pages/admin/workspaces/api/set-workspace-feature.mutation";
import { useUpdateWorkspacePlanMutation } from "@/pages/admin/workspaces/api/update-workspace-plan.mutation";

type Feature = WorkspaceDetailQueryResult["features"][number];

const STATUS_TONE = {
  active: "success",
  canceled: "neutral",
  past_due: "destructive",
  trialing: "info"
} as const;

function PlanPanel({ workspace }: { workspace: WorkspaceDetailQueryResult }) {
  const queryClient = useQueryClient();
  const plansQuery = useGetPlansQuery();
  const mutation = useUpdateWorkspacePlanMutation({
    onError: (error) => toast.error(error.message || "Failed to update plan"),
    onSuccess: () => {
      toast.success("Plan updated");
      void queryClient.invalidateQueries({ queryKey: workspaceDetailQueryKeys.byId(workspace.id) });
    }
  });

  const status = (
    workspace.status in STATUS_TONE ? workspace.status : "active"
  ) as keyof typeof STATUS_TONE;

  return (
    <Panel>
      <PanelHeader
        title="Plan & billing"
        description={workspace.owner?.email ?? "No owner on record"}
      />
      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="mt-1">
            <Badge tone={STATUS_TONE[status]}>{status.replace("_", " ")}</Badge>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">MRR</p>
          <p className="mt-1 font-medium text-foreground tabular-nums">
            {formatCurrency(workspace.plan.mrr)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Seats included</p>
          <p className="mt-1 font-medium text-foreground tabular-nums">
            {formatNumber(workspace.plan.seatsIncluded)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="mt-1 font-medium text-foreground">{formatDate(workspace.createdOn)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        <span className="text-sm text-muted-foreground">Plan</span>
        {plansQuery.data ? (
          <Segmented
            ariaLabel="Workspace plan"
            onChange={(planId) => mutation.mutate({ id: workspace.id, planId })}
            options={plansQuery.data.map((plan) => {
              return { label: plan.name, value: plan.id };
            })}
            value={workspace.plan.id}
          />
        ) : null}
        {mutation.isPending ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
      </div>
    </Panel>
  );
}

function TeamPanel({ workspace }: { workspace: WorkspaceDetailQueryResult }) {
  const { user: currentUser } = useAuth();

  return (
    <Panel>
      <PanelHeader
        title="Team"
        description={`${workspace.team.members.length} members · ${workspace.team.invitations.length} pending invites`}
      />
      {workspace.team.members.length > 0 ? (
        <ul className="divide-y divide-border">
          {workspace.team.members.map((member) => {
            const isSelf = member.userId === currentUser?.id;
            const canImpersonate = !isSelf && member.role !== "owner";

            return (
              <li className="flex items-center justify-between gap-4 px-5 py-3" key={member.id}>
                <div>
                  <p className="text-sm text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={member.role === "owner" ? "brand" : "neutral"}>{member.role}</Badge>
                  {canImpersonate ? (
                    <Button
                      onClick={() => impersonateAndOpenConsole(member.userId)}
                      size="sm"
                      variant="outline"
                    >
                      Impersonate
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ConsoleEmptyState title="No members" />
      )}
    </Panel>
  );
}

function FeatureOverridesPanel({ workspace }: { workspace: WorkspaceDetailQueryResult }) {
  const queryClient = useQueryClient();
  const mutation = useSetWorkspaceFeatureMutation({
    onError: (error) => toast.error(error.message || "Failed to update feature"),
    onSuccess: () => {
      toast.success("Feature override updated");
      void queryClient.invalidateQueries({ queryKey: workspaceDetailQueryKeys.byId(workspace.id) });
    }
  });

  function valueFor(feature: Feature): "inherit" | "on" | "off" {
    if (!feature.overridden) return "inherit";
    return feature.enabledForOrg ? "on" : "off";
  }

  return (
    <Panel>
      <PanelHeader
        title="Feature overrides"
        description="Force a feature on or off for this workspace only, regardless of the global default"
      />
      <div className="divide-y divide-border">
        {workspace.features.map((feature) => (
          <div className="flex items-center justify-between gap-4 px-5 py-3.5" key={feature.key}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{feature.name}</p>
              <p className="text-xs text-muted-foreground">
                Global default: {feature.enabled ? "on" : "off"}
                {!feature.planEligible ? " · not included on this plan" : ""}
              </p>
            </div>
            <Segmented
              ariaLabel={`Override ${feature.name}`}
              onChange={(next) => {
                if (next === "inherit") {
                  mutation.mutate({
                    enabled: null,
                    key: feature.key,
                    organizationId: workspace.id
                  });
                } else {
                  mutation.mutate({
                    enabled: next === "on",
                    key: feature.key,
                    organizationId: workspace.id
                  });
                }
              }}
              options={[
                { label: "Inherit", value: "inherit" },
                { label: "On", value: "on" },
                { label: "Off", value: "off" }
              ]}
              value={valueFor(feature)}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ActivityPanel({ workspace }: { workspace: WorkspaceDetailQueryResult }) {
  return (
    <Panel>
      <PanelHeader title="Recent activity" description="This workspace's audit trail" />
      {workspace.activity.length > 0 ? (
        <ul className="divide-y divide-border">
          {workspace.activity.map((entry) => {
            const Icon = auditIcon(entry.action);
            return (
              <li className="flex items-start gap-3 px-5 py-3.5" key={entry.id}>
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{auditSentence(entry)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatRelativeTime(entry.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ConsoleEmptyState title="No activity yet" />
      )}
    </Panel>
  );
}

export function AdminWorkspaceDetailPage({ id }: { id: string }) {
  const query = useGetWorkspaceDetailQuery(id);

  if (query.isError) {
    return (
      <ConsoleErrorState
        description="Couldn't load this workspace."
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <ConsoleSkeleton />;

  const workspace = query.data;

  return (
    <div className="space-y-8">
      <div>
        <Button asChild className="mb-3 px-0" size="sm" variant="ghost">
          <Link to="/admin/workspaces">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to workspaces
          </Link>
        </Button>
        <SectionHeading
          eyebrow="Platform"
          title={workspace.name}
          description={`/${workspace.slug}`}
        />
      </div>

      <PlanPanel workspace={workspace} />
      <TeamPanel workspace={workspace} />
      <FeatureOverridesPanel workspace={workspace} />
      <ActivityPanel workspace={workspace} />
    </div>
  );
}
