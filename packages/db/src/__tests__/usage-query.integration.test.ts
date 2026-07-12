import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  getAiUsageByFeature,
  getAiUsageByModel,
  getAiUsageTokenTotals,
  UNATTRIBUTED_USAGE_LABEL
} from "@saasweave/db";

import { resetDb, seedOrgWithOwner, seedUsageEvents } from "./db-harness";

describe.sequential("usage-query", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("aggregates AI usage by model, feature, and token totals", async () => {
    const seed = await seedOrgWithOwner();
    const since = new Date("2026-06-01T00:00:00.000Z");

    await seedUsageEvents(seed.organizationId, [
      {
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        feature: "chat",
        inputTokens: 100,
        metric: "ai_tokens",
        model: "gpt-4",
        outputTokens: 50,
        provider: "openai",
        quantity: 150
      },
      {
        createdAt: new Date("2026-06-02T10:00:00.000Z"),
        feature: "summarize",
        inputTokens: 200,
        metric: "ai_tokens",
        model: "claude-3",
        outputTokens: 80,
        provider: "anthropic",
        quantity: 280
      },
      {
        createdAt: new Date("2026-06-03T10:00:00.000Z"),
        metric: "ai_tokens",
        model: null,
        outputTokens: 30,
        provider: null,
        quantity: 30
      },
      {
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
        inputTokens: 999,
        metric: "ai_tokens",
        model: "old-model",
        outputTokens: 1,
        provider: "openai",
        quantity: 1_000
      }
    ]);

    const byModel = await getAiUsageByModel(seed.organizationId, since);
    expect(byModel).toEqual([
      {
        inputTokens: 200,
        model: "claude-3",
        outputTokens: 80,
        provider: "anthropic",
        requests: 1
      },
      {
        inputTokens: 100,
        model: "gpt-4",
        outputTokens: 50,
        provider: "openai",
        requests: 1
      },
      {
        inputTokens: 0,
        model: UNATTRIBUTED_USAGE_LABEL,
        outputTokens: 30,
        provider: UNATTRIBUTED_USAGE_LABEL,
        requests: 1
      }
    ]);

    const byFeature = await getAiUsageByFeature(seed.organizationId, since);
    expect(byFeature).toEqual([
      { feature: "summarize", requests: 1, tokens: 280 },
      { feature: "chat", requests: 1, tokens: 150 },
      { feature: UNATTRIBUTED_USAGE_LABEL, requests: 1, tokens: 30 }
    ]);

    const totals = await getAiUsageTokenTotals(seed.organizationId, since);
    expect(totals).toEqual({ inputTokens: 300, outputTokens: 160 });
  });
});
