import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "#@/connection";
import { usageEvent } from "#@/schema/index";
import { UNATTRIBUTED_USAGE_LABEL } from "#@/usage-attribution";

export { UNATTRIBUTED_USAGE_LABEL, usageEventTokenSplit } from "#@/usage-attribution";

export type AiUsageByModelRow = {
  model: string;
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
};

export type AiUsageByFeatureRow = {
  feature: string;
  requests: number;
  tokens: number;
};

export type AiUsageTokenTotals = {
  inputTokens: number;
  outputTokens: number;
};

const modelBucket = sql<string>`case when ${usageEvent.model} is null or ${usageEvent.provider} is null then ${UNATTRIBUTED_USAGE_LABEL} else ${usageEvent.model} end`;
const providerBucket = sql<string>`case when ${usageEvent.model} is null or ${usageEvent.provider} is null then ${UNATTRIBUTED_USAGE_LABEL} else ${usageEvent.provider} end`;
const featureBucket = sql<string>`coalesce(${usageEvent.feature}, ${UNATTRIBUTED_USAGE_LABEL})`;

const inputTokensSum = sql<number>`coalesce(sum(case when ${usageEvent.metric} = 'ai_tokens' then coalesce(${usageEvent.inputTokens}, case when ${usageEvent.outputTokens} is null then ${usageEvent.quantity} else 0 end) else 0 end), 0)::int`;
const outputTokensSum = sql<number>`coalesce(sum(case when ${usageEvent.metric} = 'ai_tokens' then coalesce(${usageEvent.outputTokens}, 0) else 0 end), 0)::int`;
const requestsSum = sql<number>`coalesce(sum(case when ${usageEvent.metric} = 'api_calls' then ${usageEvent.quantity} when ${usageEvent.metric} = 'ai_tokens' then 1 else 0 end), 0)::int`;
const featureTokensSum = sql<number>`coalesce(sum(case when ${usageEvent.metric} = 'ai_tokens' then coalesce(${usageEvent.inputTokens}, 0) + coalesce(${usageEvent.outputTokens}, case when ${usageEvent.inputTokens} is null then ${usageEvent.quantity} else 0 end) else 0 end), 0)::int`;

function sinceFilter(organizationId: string, since: Date) {
  return and(eq(usageEvent.organizationId, organizationId), gte(usageEvent.createdAt, since));
}

function hasActivity(row: {
  requests: number;
  inputTokens?: number;
  outputTokens?: number;
  tokens?: number;
}) {
  const tokens = row.tokens ?? (row.inputTokens ?? 0) + (row.outputTokens ?? 0);
  return row.requests > 0 || tokens > 0;
}

export async function getAiUsageByModel(
  organizationId: string,
  since: Date
): Promise<AiUsageByModelRow[]> {
  const rows = await db
    .select({
      inputTokens: inputTokensSum,
      model: modelBucket,
      outputTokens: outputTokensSum,
      provider: providerBucket,
      requests: requestsSum
    })
    .from(usageEvent)
    .where(sinceFilter(organizationId, since))
    // Group by the raw columns; the model/provider buckets are CASE expressions
    // functionally dependent on them, which Postgres accepts (grouping by the
    // bucket expression itself fails because Drizzle renders it unqualified in
    // SELECT but qualified in GROUP BY, so the two don't match).
    .groupBy(usageEvent.model, usageEvent.provider);

  const mapped = rows
    .map((row) => {
      return {
        inputTokens: Number(row.inputTokens),
        model: row.model,
        outputTokens: Number(row.outputTokens),
        provider: row.provider,
        requests: Number(row.requests)
      };
    })
    .filter(hasActivity);

  // mapped is a freshly-created local array, so sorting in place is safe.
  // eslint-disable-next-line unicorn/no-array-sort -- toSorted needs es2023 lib not configured here
  return mapped.sort(
    (left, right) => right.inputTokens + right.outputTokens - (left.inputTokens + left.outputTokens)
  );
}

export async function getAiUsageByFeature(
  organizationId: string,
  since: Date
): Promise<AiUsageByFeatureRow[]> {
  const rows = await db
    .select({
      feature: featureBucket,
      requests: requestsSum,
      tokens: featureTokensSum
    })
    .from(usageEvent)
    .where(sinceFilter(organizationId, since))
    // Group by the raw column; featureBucket is coalesce(feature, …) dependent on it.
    .groupBy(usageEvent.feature);

  const mapped = rows
    .map((row) => {
      return {
        feature: row.feature,
        requests: Number(row.requests),
        tokens: Number(row.tokens)
      };
    })
    .filter(hasActivity);

  // mapped is a freshly-created local array, so sorting in place is safe.
  // eslint-disable-next-line unicorn/no-array-sort -- toSorted needs es2023 lib not configured here
  return mapped.sort((left, right) => right.tokens - left.tokens);
}

export async function getAiUsageTokenTotals(
  organizationId: string,
  since: Date
): Promise<AiUsageTokenTotals> {
  const [row] = await db
    .select({
      inputTokens: inputTokensSum,
      outputTokens: outputTokensSum
    })
    .from(usageEvent)
    .where(and(sinceFilter(organizationId, since), eq(usageEvent.metric, "ai_tokens")));

  return {
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0)
  };
}
