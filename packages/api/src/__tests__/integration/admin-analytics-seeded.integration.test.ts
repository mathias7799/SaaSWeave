/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect } from "vite-plus/test";

import { db } from "@saasweave/db";
import { organization, usageEvent } from "@saasweave/db/schema";

import {
  createCallerFor,
  integrationIt,
  seedOrganizationPlan,
  seedOrgWithOwner,
  seedPlatformAdmin
} from "./harness";

async function seedAdminCaller(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedPlatformAdmin(seed.userId);
  return createCallerFor({ seed, userRole: "admin" });
}

describe.sequential("admin analytics seeded", () => {
  integrationIt("platformStats aggregates usage and multiple workspaces", async () => {
    const seed = await seedOrgWithOwner({ organizationName: "Primary workspace" });
    const secondary = await seedOrgWithOwner({ organizationName: "Secondary workspace" });
    await seedOrganizationPlan(seed.organizationId, "scale");
    await seedOrganizationPlan(secondary.organizationId, "growth");
    await db.insert(usageEvent).values({
      createdAt: new Date(),
      id: randomUUID(),
      metric: "ai_tokens",
      organizationId: seed.organizationId,
      quantity: 50_000
    });
    await db
      .update(organization)
      .set({ subscriptionStatus: "canceled" })
      .where(eq(organization.id, secondary.organizationId));
    const caller = await seedAdminCaller(seed);

    const stats = await caller.admin.platformStats();
    const roster = await caller.admin.workspaces.list({});

    expect(stats.totalWorkspaces).toBeGreaterThanOrEqual(2);
    expect(stats.kpis.some((kpi) => kpi.key === "ai_spend")).toBe(true);
    expect(roster.workspaces.length).toBeGreaterThanOrEqual(2);
  });
});
