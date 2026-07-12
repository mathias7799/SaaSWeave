/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { randomUUID } from "node:crypto";

import { describe, expect } from "vite-plus/test";

import { db } from "@saasweave/db";
import { usageEvent } from "@saasweave/db/schema";

import {
  createCallerFor,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

async function seedAiUsageEvents(organizationId: string): Promise<void> {
  const now = new Date();
  await db.insert(usageEvent).values([
    {
      createdAt: now,
      feature: "chat",
      id: randomUUID(),
      inputTokens: 400,
      metric: "ai_tokens",
      model: "gpt-4o",
      organizationId,
      outputTokens: 600,
      provider: "openai",
      quantity: 1000
    },
    {
      createdAt: now,
      id: randomUUID(),
      metric: "api_calls",
      organizationId,
      quantity: 5
    }
  ]);
}

describe.sequential("console aiUsage", () => {
  integrationIt("returns empty analytics when no usage events exist", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { ai_assistant: true });
    const caller = await createCallerFor({ seed });

    const usage = await caller.console.aiUsage();

    expect(usage.totals.tokens).toBe(0);
    expect(usage.totals.requests).toBe(0);
    expect(usage.byModel).toEqual([]);
    expect(usage.byFeature).toEqual([]);
    expect(usage.daily).toHaveLength(30);
  });

  integrationIt("aggregates seeded usage into totals and breakdowns", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { ai_assistant: true });
    await seedAiUsageEvents(seed.organizationId);
    const caller = await createCallerFor({ seed });

    const usage = await caller.console.aiUsage();

    expect(usage.totals.tokens).toBe(1000);
    expect(usage.totals.inputTokens).toBe(400);
    expect(usage.totals.outputTokens).toBe(600);
    expect(usage.totals.requests).toBe(5);
    expect(usage.byModel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: "gpt-4o",
          provider: "openai",
          requests: 1
        })
      ])
    );
    expect(usage.byFeature).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feature: "chat",
          requests: 1,
          tokens: 1000
        })
      ])
    );
  });
});
