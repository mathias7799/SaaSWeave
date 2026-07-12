import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { computeCurrentMrr, periodMonthLabel } from "@saasweave/app/billing/compute-current-mrr";
import { cacheWrap } from "@saasweave/cache";
import {
  countOrganizations,
  db,
  getLatestPlatformAnalyticsSnapshot,
  getOrganizationPlanDistribution,
  listAdminWorkspacesPage,
  listMrrSnapshots,
  PLATFORM_ANALYTICS_METRICS
} from "@saasweave/db";
import {
  auditLog,
  featureFlag,
  member,
  organizationFeatureFlag,
  usageEvent,
  user
} from "@saasweave/db/schema";

import { getPlanCatalog, resolvePlanEntry } from "#@/lib/plans";

const ANALYTICS_CACHE_TTL_SECONDS = 300;
const ADMIN_ROSTER_PAGE_SIZE = 50;

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function thirtyDaysAgo(): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date;
}

function analyticsCacheTag(): string {
  return "platform-analytics";
}

export type PlatformKpi = {
  key: string;
  label: string;
  value: number;
  unit: "currency" | "count" | "percent" | "tokens";
  deltaPct: number;
  spark: number[];
};

export type MrrPoint = { label: string; mrr: number; newMrr: number; churnedMrr: number };

export type PlanDistribution = { planId: string; name: string; customers: number; mrr: number };

export type AdminWorkspace = {
  id: string;
  name: string;
  owner: string;
  planId: string;
  planName: string;
  seats: number;
  mrr: number;
  aiTokens30d: number;
  status: "active" | "trialing" | "past_due" | "churned";
  createdOn: string;
  lastActive: string;
};

export type FeatureStat = {
  key: string;
  adoptionPct: number;
  workspacesEnabled: number;
  totalWorkspaces: number;
  requests30d: number;
};

export type PlatformStatsResponse = {
  kpis: PlatformKpi[];
  mrrTrend: MrrPoint[];
  mrrTrendCollecting: boolean;
  planDistribution: PlanDistribution[];
  totalWorkspaces: number;
};

export type AdminWorkspacesResponse = {
  nextCursor: string | null;
  totalWorkspaces: number;
  workspaces: AdminWorkspace[];
};

export type FeatureStatsResponse = { totalWorkspaces: number; stats: FeatureStat[] };

function statusFor(subscriptionStatus: string | null): AdminWorkspace["status"] {
  if (subscriptionStatus === "canceled") return "churned";
  if (subscriptionStatus === "past_due") return "past_due";
  if (subscriptionStatus === "trialing") return "trialing";
  return "active";
}

async function ownerNamesByOrg(organizationIds: string[]): Promise<Map<string, string>> {
  if (organizationIds.length === 0) return new Map();
  const rows = await db
    .select({ name: user.name, organizationId: member.organizationId })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.role, "owner"), inArray(member.organizationId, organizationIds)));
  return new Map(rows.map((row) => [row.organizationId, row.name]));
}

async function memberCountsByOrg(organizationIds: string[]): Promise<Map<string, number>> {
  if (organizationIds.length === 0) return new Map();
  const rows = await db
    .select({ count: sql<number>`count(*)::int`, organizationId: member.organizationId })
    .from(member)
    .where(inArray(member.organizationId, organizationIds))
    .groupBy(member.organizationId);
  return new Map(rows.map((row) => [row.organizationId, Number(row.count)]));
}

async function tokensByOrg(organizationIds: string[], since: Date): Promise<Map<string, number>> {
  if (organizationIds.length === 0) return new Map();
  const rows = await db
    .select({
      organizationId: usageEvent.organizationId,
      total: sql<number>`coalesce(sum(${usageEvent.quantity}), 0)::bigint`
    })
    .from(usageEvent)
    .where(
      and(
        eq(usageEvent.metric, "ai_tokens"),
        gte(usageEvent.createdAt, since),
        inArray(usageEvent.organizationId, organizationIds)
      )
    )
    .groupBy(usageEvent.organizationId);
  return new Map(rows.map((row) => [row.organizationId, Number(row.total)]));
}

async function lastActiveByOrg(organizationIds: string[]): Promise<Map<string, string>> {
  if (organizationIds.length === 0) return new Map();
  const rows = await db
    .select({
      last: sql<string>`max(${auditLog.createdAt})`,
      organizationId: auditLog.organizationId
    })
    .from(auditLog)
    .where(inArray(auditLog.organizationId, organizationIds))
    .groupBy(auditLog.organizationId);
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.organizationId && row.last) {
      map.set(row.organizationId, new Date(row.last).toISOString());
    }
  }
  return map;
}

const adminWorkspacesInputSchema = z.object({
  cursor: z.string().optional()
});

function decodeCursor(cursor: string | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
    createdAt: string;
    id: string;
  };
  return parsed;
}

function encodeCursor(cursor: { createdAt: string; id: string } | null): string | null {
  if (!cursor) return null;
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export async function buildAdminWorkspaces(
  input: z.infer<typeof adminWorkspacesInputSchema> = {}
): Promise<AdminWorkspacesResponse> {
  const parsed = adminWorkspacesInputSchema.parse(input);
  const since = thirtyDaysAgo();
  const page = await listAdminWorkspacesPage({
    cursor: decodeCursor(parsed.cursor),
    limit: ADMIN_ROSTER_PAGE_SIZE
  });
  const organizationIds = page.workspaces.map((org) => org.id);

  const [owners, counts, tokens, lastActive, catalog, totalWorkspaces] = await Promise.all([
    ownerNamesByOrg(organizationIds),
    memberCountsByOrg(organizationIds),
    tokensByOrg(organizationIds, since),
    lastActiveByOrg(organizationIds),
    getPlanCatalog(),
    countOrganizations()
  ]);

  const workspaces: AdminWorkspace[] = page.workspaces.map((org) => {
    const seats = counts.get(org.id) ?? 1;
    const status = statusFor(org.subscriptionStatus);
    const resolved = resolvePlanEntry(catalog, org.planId);
    return {
      aiTokens30d: tokens.get(org.id) ?? 0,
      createdOn: org.createdAt.toISOString().slice(0, 10),
      id: org.id,
      lastActive: lastActive.get(org.id) ?? org.createdAt.toISOString(),
      mrr: status === "churned" ? 0 : resolved.price,
      name: org.name,
      owner: owners.get(org.id) ?? "—",
      planId: org.planId ?? "free",
      planName: resolved.name,
      seats,
      status
    };
  });

  return {
    nextCursor: encodeCursor(page.nextCursor),
    totalWorkspaces,
    workspaces
  };
}

export async function buildPlatformStats(): Promise<PlatformStatsResponse> {
  return cacheWrap(
    "platform-stats:v2",
    async () => {
      const since = thirtyDaysAgo();
      const [tokenRow, catalog, currentMrr, snapshotRows, aggregateSnapshot] = await Promise.all([
        db
          .select({ total: sql<number>`coalesce(sum(${usageEvent.quantity}), 0)::bigint` })
          .from(usageEvent)
          .where(and(eq(usageEvent.metric, "ai_tokens"), gte(usageEvent.createdAt, since))),
        getPlanCatalog(),
        computeCurrentMrr(),
        listMrrSnapshots(12),
        getLatestPlatformAnalyticsSnapshot(PLATFORM_ANALYTICS_METRICS.TOTAL_WORKSPACES)
      ]);

      const totalWorkspaces = aggregateSnapshot?.value ?? (await countOrganizations());
      const storedPlanDistribution = aggregateSnapshot?.metadata?.planDistribution;
      const planCounts = Array.isArray(storedPlanDistribution)
        ? (storedPlanDistribution as Array<{ count: number; planId: string }>)
        : await getOrganizationPlanDistribution();
      const byPlan = new Map<string, number>();
      for (const plan of planCounts) {
        byPlan.set(plan.planId, plan.count);
      }

      const planOrder = ["enterprise", "scale", "growth", "starter", "free"];
      const planDistribution: PlanDistribution[] = planOrder
        .filter((planId) => byPlan.has(planId))
        .map((planId) => {
          const customers = byPlan.get(planId) ?? 0;
          const resolved = planId === "free" ? null : planId;
          const entry = resolvePlanEntry(catalog, resolved);
          return { customers, mrr: customers * entry.price, name: entry.name, planId };
        });

      const totalMrr = currentMrr.mrr;
      const totalTokens = Number(tokenRow[0]?.total ?? 0);
      const aiCogs = round((totalTokens / 1_000_000) * 9, 0);

      const mrrTrendCollecting = snapshotRows.length < 12;
      const chronologicalSnapshots: typeof snapshotRows = [];
      for (let index = snapshotRows.length - 1; index >= 0; index -= 1) {
        chronologicalSnapshots.push(snapshotRows[index]!);
      }
      const mrrTrend: MrrPoint[] = chronologicalSnapshots.map((row) => {
        return {
          churnedMrr: row.churnedMrr ?? 0,
          label: periodMonthLabel(row.periodMonth),
          mrr: row.mrr,
          newMrr: row.newMrr
        };
      });
      const workspaceSpark = chronologicalSnapshots.map((row) => row.activeOrgs);

      const previousMrr = mrrTrend.at(-2)?.mrr ?? 0;
      const mrrDelta =
        previousMrr > 0 ? round(((totalMrr - previousMrr) / previousMrr) * 100, 1) : 0;
      const previousWorkspaces = workspaceSpark.at(-2) ?? 0;
      const workspaceDelta =
        previousWorkspaces > 0
          ? round(((totalWorkspaces - previousWorkspaces) / previousWorkspaces) * 100, 1)
          : 0;

      const kpis: PlatformKpi[] = [
        {
          deltaPct: mrrDelta,
          key: "mrr",
          label: "MRR",
          spark: mrrTrend.map((point) => point.mrr),
          unit: "currency",
          value: totalMrr
        },
        {
          deltaPct: workspaceDelta,
          key: "workspaces",
          label: "Active workspaces",
          spark: workspaceSpark,
          unit: "count",
          value: totalWorkspaces
        },
        {
          deltaPct: 0,
          key: "nrr",
          label: "Revenue retention",
          spark: mrrTrend.map((point) => (point.churnedMrr > 0 ? 0 : 100)),
          unit: "percent",
          value: totalMrr > 0 ? 100 : 0
        },
        {
          deltaPct: 0,
          key: "ai_spend",
          label: "AI COGS (30d)",
          spark: mrrTrend.map((_, index) => (index === mrrTrend.length - 1 ? aiCogs : 0)),
          unit: "currency",
          value: aiCogs
        }
      ];

      return { kpis, mrrTrend, mrrTrendCollecting, planDistribution, totalWorkspaces };
    },
    {
      namespace: "admin",
      tags: [analyticsCacheTag()],
      ttlSeconds: ANALYTICS_CACHE_TTL_SECONDS
    }
  );
}

export async function buildFeatureStats(featureKeys: string[]): Promise<FeatureStatsResponse> {
  return cacheWrap(
    `feature-stats:${featureKeys.join(",")}:v2`,
    async () => {
      const since = thirtyDaysAgo();

      const [countRow, usageRows, flagRows, overrideRows] = await Promise.all([
        countOrganizations().then((count) => [{ count }]),
        db
          .select({
            metric: usageEvent.metric,
            total: sql<number>`coalesce(sum(${usageEvent.quantity}), 0)::bigint`
          })
          .from(usageEvent)
          .where(gte(usageEvent.createdAt, since))
          .groupBy(usageEvent.metric),
        db.select({ enabled: featureFlag.enabled, key: featureFlag.key }).from(featureFlag),
        db
          .select({
            enabled: organizationFeatureFlag.enabled,
            featureKey: organizationFeatureFlag.featureKey
          })
          .from(organizationFeatureFlag)
      ]);

      const totalWorkspaces = Number(countRow[0]?.count ?? 0);
      const usageByMetric = new Map(usageRows.map((row) => [row.metric, Number(row.total)]));
      const globalEnabledByKey = new Map(flagRows.map((row) => [row.key, row.enabled]));

      const overridesByKey = new Map<string, { enabledCount: number; disabledCount: number }>();
      for (const row of overrideRows) {
        const bucket = overridesByKey.get(row.featureKey) ?? { enabledCount: 0, disabledCount: 0 };
        if (row.enabled) bucket.enabledCount += 1;
        else bucket.disabledCount += 1;
        overridesByKey.set(row.featureKey, bucket);
      }

      const stats: FeatureStat[] = featureKeys.map((key) => {
        const globalEnabled = globalEnabledByKey.get(key) ?? false;
        const overrides = overridesByKey.get(key) ?? { enabledCount: 0, disabledCount: 0 };
        const workspacesEnabled = globalEnabled
          ? totalWorkspaces - overrides.disabledCount
          : overrides.enabledCount;

        return {
          adoptionPct:
            totalWorkspaces > 0 ? round((workspacesEnabled / totalWorkspaces) * 100, 1) : 0,
          key,
          requests30d: key === "ai_assistant" ? (usageByMetric.get("ai_tokens") ?? 0) : 0,
          totalWorkspaces,
          workspacesEnabled: Math.max(0, workspacesEnabled)
        };
      });

      return { stats, totalWorkspaces };
    },
    {
      namespace: "admin",
      tags: [analyticsCacheTag()],
      ttlSeconds: ANALYTICS_CACHE_TTL_SECONDS
    }
  );
}
