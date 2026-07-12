import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Link } from "@saasweave/i18n/tanstack-start/components/link";
import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";

import {
  Badge,
  ConsoleErrorState,
  ConsoleSkeleton,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatRelativeTime,
  Panel,
  PanelHeader,
  SectionHeading,
  StatTile
} from "@/shared/ui/console-kit";

import { useGetWorkspacesQuery } from "@/pages/admin/workspaces/api/get-workspaces.query";

const STATUS_TONE = {
  active: "success",
  churned: "neutral",
  past_due: "destructive",
  trialing: "info"
} as const;

const STATUS_LABEL = {
  active: "Active",
  churned: "Churned",
  past_due: "Past due",
  trialing: "Trialing"
} as const;

export function AdminWorkspacesPage() {
  const query = useGetWorkspacesQuery();
  const [search, setSearch] = useState("");

  const workspaces = query.data?.workspaces;
  const filtered = useMemo(() => {
    if (!workspaces) return [];
    const term = search.trim().toLowerCase();
    if (!term) return workspaces;
    return workspaces.filter(
      (ws) => ws.name.toLowerCase().includes(term) || ws.owner.toLowerCase().includes(term)
    );
  }, [workspaces, search]);

  if (query.isError) {
    return (
      <ConsoleErrorState description="Couldn't load workspaces." onRetry={() => query.refetch()} />
    );
  }
  if (!workspaces) return <ConsoleSkeleton />;

  const active = workspaces.filter((ws) => ws.status === "active").length;
  const trialing = workspaces.filter((ws) => ws.status === "trialing").length;
  const pastDue = workspaces.filter((ws) => ws.status === "past_due").length;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform"
        title="Workspaces"
        description="Every customer workspace on SaaSWeave, with plan, seats, and health at a glance."
        action={
          <Button variant="outline">
            <Download className="size-4" aria-hidden="true" />
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total shown" value={formatNumber(workspaces.length)} />
        <StatTile label="Active" value={formatNumber(active)} />
        <StatTile label="Trialing" value={formatNumber(trialing)} />
        <StatTile label="Past due" value={formatNumber(pastDue)} />
      </div>

      <Panel>
        <PanelHeader
          title="All workspaces"
          action={
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or owner"
                aria-label="Search workspaces"
                className="h-9 w-56 pl-8"
              />
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-5 py-3 font-medium">Workspace</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Seats</th>
                <th className="px-5 py-3 text-right font-medium">MRR</th>
                <th className="px-5 py-3 text-right font-medium">Tokens (30d)</th>
                <th className="px-5 py-3 text-right font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((ws) => (
                <tr key={ws.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-5 py-3">
                    <Link
                      className="font-medium text-foreground hover:underline"
                      params={{ id: ws.id }}
                      to="/admin/workspaces/$id"
                    >
                      {ws.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{ws.owner}</div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{ws.planName}</td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[ws.status]}>{STATUS_LABEL[ws.status]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                    {formatNumber(ws.seats)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-foreground tabular-nums">
                    {formatCurrency(ws.mrr)}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                    {formatCompact(ws.aiTokens30d)}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">
                    {formatRelativeTime(ws.lastActive)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No workspaces match “{search}”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
