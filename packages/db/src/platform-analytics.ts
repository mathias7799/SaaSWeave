import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "#@/connection";
import { organization, usageEvent } from "#@/schema/index";
import { platformAnalyticsDaily } from "#@/schema/platform-analytics-daily.schema";

export const PLATFORM_ANALYTICS_METRICS = {
  AI_TOKENS_30D: "ai_tokens_30d",
  TOTAL_WORKSPACES: "total_workspaces",
  ACTIVE_WORKSPACES: "active_workspaces"
} as const;

export type PlatformAnalyticsMetricKey =
  (typeof PLATFORM_ANALYTICS_METRICS)[keyof typeof PLATFORM_ANALYTICS_METRICS];

export type OrganizationPlanCount = { count: number; planId: string };

function dailyId(statDate: string, metricKey: string): string {
  return `${statDate}:${metricKey}`;
}

function formatStatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function upsertPlatformAnalyticsDaily(input: {
  metadata?: Record<string, unknown>;
  metricKey: PlatformAnalyticsMetricKey;
  statDate: string;
  value: number;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(platformAnalyticsDaily)
    .values({
      id: dailyId(input.statDate, input.metricKey),
      metadata: input.metadata ?? null,
      metricKey: input.metricKey,
      refreshedAt: now,
      statDate: input.statDate,
      value: input.value
    })
    .onConflictDoUpdate({
      set: {
        metadata: input.metadata ?? null,
        refreshedAt: now,
        value: input.value
      },
      target: platformAnalyticsDaily.id
    });
}

export async function refreshPlatformAnalyticsDaily(
  statDate = formatStatDate(new Date())
): Promise<{
  activeWorkspaces: number;
  aiTokens30d: number;
  statDate: string;
  totalWorkspaces: number;
}> {
  const dayStart = new Date(`${statDate}T00:00:00.000Z`);
  const since = new Date(dayStart);
  since.setUTCDate(since.getUTCDate() - 30);

  const [orgCounts, tokenRow, planDistribution] = await Promise.all([
    db
      .select({
        active: sql<number>`count(*) filter (where ${organization.subscriptionStatus} IS DISTINCT FROM 'canceled')::int`,
        total: sql<number>`count(*)::int`
      })
      .from(organization),
    db
      .select({ total: sql<number>`coalesce(sum(${usageEvent.quantity}), 0)::bigint` })
      .from(usageEvent)
      .where(and(eq(usageEvent.metric, "ai_tokens"), gte(usageEvent.createdAt, since))),
    getOrganizationPlanDistribution()
  ]);

  const totalWorkspaces = Number(orgCounts[0]?.total ?? 0);
  const activeWorkspaces = Number(orgCounts[0]?.active ?? 0);
  const aiTokens30d = Number(tokenRow[0]?.total ?? 0);

  await Promise.all([
    upsertPlatformAnalyticsDaily({
      metadata: { planDistribution },
      metricKey: PLATFORM_ANALYTICS_METRICS.TOTAL_WORKSPACES,
      statDate,
      value: totalWorkspaces
    }),
    upsertPlatformAnalyticsDaily({
      metricKey: PLATFORM_ANALYTICS_METRICS.ACTIVE_WORKSPACES,
      statDate,
      value: activeWorkspaces
    }),
    upsertPlatformAnalyticsDaily({
      metricKey: PLATFORM_ANALYTICS_METRICS.AI_TOKENS_30D,
      statDate,
      value: aiTokens30d
    })
  ]);

  return { activeWorkspaces, aiTokens30d, statDate, totalWorkspaces };
}

export async function getOrganizationPlanDistribution(): Promise<OrganizationPlanCount[]> {
  const rows = await db
    .select({
      count: sql<number>`count(*)::int`,
      planId: sql<string>`coalesce(${organization.planId}, 'free')`
    })
    .from(organization)
    .where(sql`${organization.subscriptionStatus} IS DISTINCT FROM 'canceled'`)
    .groupBy(organization.planId);

  return rows.map((row) => {
    return { count: Number(row.count), planId: row.planId };
  });
}

export async function getLatestPlatformAnalyticsSnapshot(metricKey: PlatformAnalyticsMetricKey) {
  const [row] = await db
    .select({ metadata: platformAnalyticsDaily.metadata, value: platformAnalyticsDaily.value })
    .from(platformAnalyticsDaily)
    .where(eq(platformAnalyticsDaily.metricKey, metricKey))
    .orderBy(desc(platformAnalyticsDaily.statDate))
    .limit(1);

  return row ? { metadata: row.metadata, value: Number(row.value) } : null;
}

export async function getLatestPlatformAnalyticsMetric(
  metricKey: PlatformAnalyticsMetricKey
): Promise<number | null> {
  const [row] = await db
    .select({ value: platformAnalyticsDaily.value })
    .from(platformAnalyticsDaily)
    .where(eq(platformAnalyticsDaily.metricKey, metricKey))
    .orderBy(desc(platformAnalyticsDaily.statDate))
    .limit(1);

  return row ? Number(row.value) : null;
}

export async function sumPlatformAnalyticsMetricRange(input: {
  fromDate: string;
  metricKey: PlatformAnalyticsMetricKey;
  toDate: string;
}): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${platformAnalyticsDaily.value}), 0)::bigint` })
    .from(platformAnalyticsDaily)
    .where(
      and(
        eq(platformAnalyticsDaily.metricKey, input.metricKey),
        gte(platformAnalyticsDaily.statDate, input.fromDate),
        lte(platformAnalyticsDaily.statDate, input.toDate)
      )
    );

  return Number(row?.total ?? 0);
}

export async function explainPlatformAnalyticsQueries(): Promise<{
  latestMetricPlan: string;
  usageAggregatePlan: string;
}> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const sinceIso = since.toISOString();

  const [latestMetric, usageAggregate] = await Promise.all([
    db.execute(sql`
      EXPLAIN (FORMAT TEXT)
      SELECT value
      FROM platform_analytics_daily
      WHERE metric_key = 'total_workspaces'
      ORDER BY stat_date DESC
      LIMIT 1
    `),
    db.execute(sql`
      EXPLAIN (FORMAT TEXT)
      SELECT coalesce(sum(quantity), 0)
      FROM usage_event
      WHERE metric = 'ai_tokens' AND created_at >= ${sinceIso}::timestamp
    `)
  ]);

  return {
    latestMetricPlan: latestMetric.map((row) => Object.values(row)[0]).join("\n"),
    usageAggregatePlan: usageAggregate.map((row) => Object.values(row)[0]).join("\n")
  };
}

export type AdminWorkspaceCursor = {
  createdAt: string;
  id: string;
};

export async function listAdminWorkspacesPage(input: {
  cursor?: AdminWorkspaceCursor | null;
  limit?: number;
}): Promise<{
  nextCursor: AdminWorkspaceCursor | null;
  workspaces: Array<{
    createdAt: Date;
    id: string;
    name: string;
    planId: string | null;
    subscriptionStatus: string | null;
  }>;
}> {
  const limit = input.limit ?? 50;
  const cursor = input.cursor;

  const baseQuery = db
    .select({
      createdAt: organization.createdAt,
      id: organization.id,
      name: organization.name,
      planId: organization.planId,
      subscriptionStatus: organization.subscriptionStatus
    })
    .from(organization);

  const rows = await (
    cursor
      ? baseQuery.where(
          sql`(${organization.createdAt}, ${organization.id}) < (${new Date(cursor.createdAt)}::timestamp, ${cursor.id})`
        )
      : baseQuery
  )
    .orderBy(desc(organization.createdAt), desc(organization.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    nextCursor: hasMore && last ? { createdAt: last.createdAt.toISOString(), id: last.id } : null,
    workspaces: page
  };
}

export async function countOrganizations(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(organization);
  return Number(row?.count ?? 0);
}
