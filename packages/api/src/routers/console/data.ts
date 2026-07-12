import { and, eq, gte, sql } from "drizzle-orm";

import { cacheWrap } from "@saasweave/cache";
import { db, getAiUsageByFeature, getAiUsageByModel, getAiUsageTokenTotals } from "@saasweave/db";
import { usageEvent } from "@saasweave/db/schema";

import { planPrice } from "#@/lib/plans";

export type TrendPoint = {
  date: string;
  label: string;
  requests: number;
  tokens: number;
};

export type MetricCard = {
  key: string;
  label: string;
  value: number;
  unit: "count" | "currency" | "tokens" | "ms" | "percent";
  deltaPct: number;
  spark: number[];
};

export type OverviewResponse = {
  metrics: MetricCard[];
  trend: TrendPoint[];
  plan: {
    name: string;
    seatsUsed: number;
    seatsIncluded: number;
    aiCreditsUsed: number;
    aiCreditsIncluded: number;
    renewsOn: string;
  };
};

export type ModelUsage = {
  model: string;
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

export type FeatureUsage = {
  feature: string;
  requests: number;
  tokens: number;
  avgLatencyMs: number;
  errorRatePct: number;
};

export type AiUsageResponse = {
  totals: {
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
    cost: number;
    avgLatencyMs: number;
    cacheHitRatePct: number;
  };
  daily: TrendPoint[];
  byModel: ModelUsage[];
  byFeature: FeatureUsage[];
};

export type Invoice = {
  id: string;
  number: string;
  issuedOn: string;
  amount: number;
  status: "paid" | "open" | "past_due";
};

export type UsageMeter = {
  key: string;
  label: string;
  unit: "tokens" | "count" | "gb";
  included: number;
  used: number;
  overageRate: number;
};

export type BillingResponse = {
  plan: {
    name: string;
    priceMonthly: number;
    cycleStart: string;
    cycleEnd: string;
    renewsOn: string;
  };
  subscription: {
    planId: string;
    status: "active" | "trialing" | "past_due" | "canceled";
    interval: "monthly" | "annual";
    seats: number;
    startedOn: string;
    renewsOn: string;
  };
  estimate: {
    base: number;
    usageOverage: number;
    seats: number;
    seatUnitPrice: number;
    total: number;
  };
  meters: UsageMeter[];
  costByCategory: { category: string; amount: number }[];
  invoices: Invoice[];
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
};

const AI_TOKEN_COST_PER_MILLION = 9;
const AI_TOKEN_OVERAGE_RATE = 0.0000045;
const API_CALL_OVERAGE_RATE = 0.0009;
const API_CALL_ALLOWANCE = 500_000;
const SEAT_UNIT_PRICE = 29;

const PLAN_TOKEN_ALLOWANCE: Record<string, number> = {
  enterprise: 500_000_000,
  growth: 60_000_000,
  scale: 120_000_000,
  starter: 10_000_000
};

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function cycleStart(): Date {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function cycleEnd(): Date {
  const date = cycleStart();
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(date.getUTCDate() - 1);
  return date;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayOffset(offsetFromToday: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetFromToday);
  return date;
}

function daysAgoLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  });
}

function sparkFrom(trend: TrendPoint[], pick: (point: TrendPoint) => number): number[] {
  return trend.slice(-14).map(pick);
}

function tokenAllowance(planId: string | null | undefined): number {
  if (!planId) return PLAN_TOKEN_ALLOWANCE.starter;
  return PLAN_TOKEN_ALLOWANCE[planId] ?? PLAN_TOKEN_ALLOWANCE.starter;
}

async function getUsageTrend(organizationId: string, days = 30): Promise<TrendPoint[]> {
  const since = dayOffset(-(days - 1));
  const dayExpr = sql<string>`to_char(${usageEvent.createdAt}, 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      date: dayExpr,
      metric: usageEvent.metric,
      total: sql<number>`coalesce(sum(${usageEvent.quantity}), 0)::bigint`
    })
    .from(usageEvent)
    .where(and(eq(usageEvent.organizationId, organizationId), gte(usageEvent.createdAt, since)))
    .groupBy(dayExpr, usageEvent.metric);

  const byDate = new Map<string, { requests: number; tokens: number }>();
  for (const row of rows) {
    const current = byDate.get(row.date) ?? { requests: 0, tokens: 0 };
    if (row.metric === "ai_tokens") current.tokens = Number(row.total);
    if (row.metric === "api_calls") current.requests = Number(row.total);
    byDate.set(row.date, current);
  }

  return Array.from({ length: days }, (_, index) => {
    const date = dayOffset(index - (days - 1));
    const key = isoDay(date);
    const values = byDate.get(key) ?? { requests: 0, tokens: 0 };
    return {
      date: key,
      label: daysAgoLabel(date),
      requests: values.requests,
      tokens: values.tokens
    };
  });
}

async function buildAiUsageUncached(organizationId: string): Promise<AiUsageResponse> {
  const since = dayOffset(-29);
  const [daily, byModelRows, byFeatureRows, tokenTotals] = await Promise.all([
    getUsageTrend(organizationId),
    getAiUsageByModel(organizationId, since),
    getAiUsageByFeature(organizationId, since),
    getAiUsageTokenTotals(organizationId, since)
  ]);

  const requests = daily.reduce((sum, point) => sum + point.requests, 0);
  const tokens = daily.reduce((sum, point) => sum + point.tokens, 0);
  const cost = round((tokens / 1_000_000) * AI_TOKEN_COST_PER_MILLION, 2);

  const byModel: ModelUsage[] = byModelRows.map((row) => {
    const rowTokens = row.inputTokens + row.outputTokens;
    return {
      cost: round((rowTokens / 1_000_000) * AI_TOKEN_COST_PER_MILLION, 2),
      inputTokens: row.inputTokens,
      model: row.model,
      outputTokens: row.outputTokens,
      provider: row.provider,
      requests: row.requests
    };
  });

  const byFeature: FeatureUsage[] = byFeatureRows.map((row) => {
    return {
      avgLatencyMs: 0,
      errorRatePct: 0,
      feature: row.feature,
      requests: row.requests,
      tokens: row.tokens
    };
  });

  return {
    byFeature,
    byModel,
    daily,
    totals: {
      avgLatencyMs: 0,
      cacheHitRatePct: 0,
      cost,
      inputTokens: tokenTotals.inputTokens,
      outputTokens: tokenTotals.outputTokens,
      requests,
      tokens
    }
  };
}

export function buildAiUsage(organizationId: string): Promise<AiUsageResponse> {
  return cacheWrap(`ai-usage:${organizationId}`, () => buildAiUsageUncached(organizationId), {
    namespace: "console",
    tags: [`organization:${organizationId}:usage`],
    ttlSeconds: 30
  });
}

export async function buildOverview(
  organizationId: string,
  plan: {
    name: string;
    planId: string | null;
    seatsUsed: number;
    seatsIncluded: number;
  }
): Promise<OverviewResponse> {
  const ai = await buildAiUsage(organizationId);
  const trend = ai.daily;
  const allowance = tokenAllowance(plan.planId);
  const monthlyRevenue = await planPrice(plan.planId);

  return {
    metrics: [
      {
        deltaPct: 0,
        key: "requests",
        label: "Requests",
        spark: sparkFrom(trend, (point) => point.requests),
        unit: "count",
        value: ai.totals.requests
      },
      {
        deltaPct: 0,
        key: "tokens",
        label: "AI tokens",
        spark: sparkFrom(trend, (point) => point.tokens),
        unit: "tokens",
        value: ai.totals.tokens
      },
      {
        deltaPct: 0,
        key: "active_users",
        label: "Team members",
        spark: Array.from({ length: 14 }, () => plan.seatsUsed),
        unit: "count",
        value: plan.seatsUsed
      },
      {
        deltaPct: 0,
        key: "revenue",
        label: "Plan MRR",
        spark: Array.from({ length: 14 }, () => monthlyRevenue),
        unit: "currency",
        value: monthlyRevenue
      }
    ],
    plan: {
      aiCreditsIncluded: round(allowance / 1_000_000, 1),
      aiCreditsUsed: round(ai.totals.tokens / 1_000_000, 1),
      name: plan.name,
      renewsOn: isoDay(cycleEnd()),
      seatsIncluded: plan.seatsIncluded,
      seatsUsed: plan.seatsUsed
    },
    trend
  };
}

export async function buildBilling(
  organizationId: string,
  usageOverrides?: Record<string, number>,
  seats = 1,
  planId: string | null = "scale"
): Promise<BillingResponse> {
  void organizationId;
  const allowance = tokenAllowance(planId);
  const apiCalls = usageOverrides?.api_calls ?? 0;
  const aiTokens = usageOverrides?.ai_tokens ?? 0;
  const base = await planPrice(planId);
  const seatCost = seats * SEAT_UNIT_PRICE;
  const usageOverage = round(
    Math.max(0, aiTokens - allowance) * AI_TOKEN_OVERAGE_RATE +
      Math.max(0, apiCalls - API_CALL_ALLOWANCE) * API_CALL_OVERAGE_RATE,
    2
  );
  const total = round(base + seatCost + usageOverage, 2);
  const start = cycleStart();
  const end = cycleEnd();
  const resolvedPlanId = planId ?? "starter";

  return {
    costByCategory: [
      { amount: base, category: "Base plan" },
      { amount: seatCost, category: "Seats" },
      { amount: usageOverage, category: "Usage overage" }
    ].filter((entry) => entry.amount > 0),
    estimate: {
      base,
      seatUnitPrice: SEAT_UNIT_PRICE,
      seats,
      total,
      usageOverage
    },
    invoices: [],
    meters: [
      {
        included: allowance,
        key: "ai_tokens",
        label: "AI tokens",
        overageRate: AI_TOKEN_OVERAGE_RATE,
        unit: "tokens",
        used: aiTokens
      },
      {
        included: API_CALL_ALLOWANCE,
        key: "api_calls",
        label: "API calls",
        overageRate: API_CALL_OVERAGE_RATE,
        unit: "count",
        used: apiCalls
      }
    ],
    paymentMethod: null,
    plan: {
      cycleEnd: isoDay(end),
      cycleStart: isoDay(start),
      name: resolvedPlanId,
      priceMonthly: base,
      renewsOn: isoDay(end)
    },
    subscription: {
      interval: "monthly",
      planId: resolvedPlanId,
      renewsOn: isoDay(end),
      seats,
      startedOn: isoDay(start),
      status: "active"
    }
  };
}
