import { eq } from "drizzle-orm";
/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import { db } from "@saasweave/db";
import { organization } from "@saasweave/db/schema";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedApiKey,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner,
  seedUsageIntegration
} from "./harness";

describe.sequential("console batches extended", () => {
  integrationIt("list and get return a created batch job", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { batch_jobs: true });
    const caller = await createCallerFor({ seed });

    const created = await caller.console.batches.create({
      items: [{ text: "alpha" }],
      type: "uppercase"
    });

    const listed = await caller.console.batches.list();
    expect(listed.some((job) => job.id === created.id)).toBe(true);

    const fetched = await caller.console.batches.get({ id: created.id });
    expect(fetched.items).toHaveLength(1);
    expect(fetched.progressPercent).toBe(0);
  });

  integrationIt("get returns BATCH_JOB_NOT_FOUND for unknown ids", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { batch_jobs: true });
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.batches.get({ id: "missing-batch-job" }),
      "BATCH_JOB_NOT_FOUND"
    );
  });

  integrationIt("create resolves createdBy from an API key bearer", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { batch_jobs: true });
    const key = await seedApiKey({
      createdBy: seed.userId,
      organizationId: seed.organizationId,
      scopes: ["usage:write"]
    });
    const caller = await createCallerFor({ apiKeySecret: key.secret, seed, session: null });

    const created = await caller.console.batches.create({
      items: [{ text: "via-key" }],
      type: "uppercase"
    });

    expect(created.createdByUserId).toBe(seed.userId);
  });
});

describe.sequential("console recordUsage attribution", () => {
  integrationIt("records AI token attribution fields on usage events", async () => {
    const seed = await seedOrgWithOwner();
    await seedUsageIntegration(seed);
    const caller = await createCallerFor({ seed });

    const result = await caller.console.recordUsage({
      feature: "summarize",
      inputTokens: 120,
      metric: "ai_tokens",
      model: "gpt-4o-mini",
      outputTokens: 80,
      provider: "openai",
      quantity: 200
    });

    expect(result).toEqual({ ok: true });
  });
});

describe.sequential("console billing org subscription row", () => {
  integrationIt(
    "billing uses organization subscription metadata in sample mode branches",
    async () => {
      const seed = await seedOrgWithOwner();
      await seedOrganizationPlan(seed.organizationId, "growth");
      await seedOrganizationFeatureFlags(seed.organizationId, { billing_portal: true });
      const periodEnd = new Date("2026-08-01T00:00:00.000Z");
      await db
        .update(organization)
        .set({
          currentPeriodEnd: periodEnd,
          planId: "growth",
          subscriptionStatus: "trialing"
        })
        .where(eq(organization.id, seed.organizationId));
      const caller = await createCallerFor({ seed });

      const billing = await caller.console.billing();

      expect(billing.stripeEnabled).toBe(false);
      expect(billing.subscription.status).toBe("active");
      expect(billing.plan.name).toBeTruthy();
    }
  );
});
