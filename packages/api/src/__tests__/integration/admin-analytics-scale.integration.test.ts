/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import {
  countOrganizations,
  explainPlatformAnalyticsQueries,
  refreshPlatformAnalyticsDaily
} from "@saasweave/db";

import { createCallerFor, integrationIt, seedOrgWithOwner, seedPlatformAdmin } from "./harness";

describe.sequential("admin analytics beyond roster page", () => {
  integrationIt("platform totals use persisted aggregates beyond roster page size", async () => {
    const seed = await seedOrgWithOwner({ organizationName: "Analytics seed primary" });
    await seedPlatformAdmin(seed.userId);

    for (let index = 0; index < 12; index += 1) {
      await seedOrgWithOwner({ organizationName: `Analytics seed ${index}` });
    }

    const snapshot = await refreshPlatformAnalyticsDaily();
    const plans = await explainPlatformAnalyticsQueries();
    const caller = await createCallerFor({ seed, userRole: "admin" });

    const stats = await caller.admin.platformStats();
    const firstPage = await caller.admin.workspaces.list({});
    const totalFromDb = await countOrganizations();

    expect(snapshot.totalWorkspaces).toBeGreaterThanOrEqual(13);
    expect(stats.totalWorkspaces).toBeGreaterThanOrEqual(13);
    expect(stats.totalWorkspaces).toBe(totalFromDb);
    expect(firstPage.workspaces.length).toBeLessThanOrEqual(50);
    expect(firstPage.totalWorkspaces).toBe(totalFromDb);
    expect(plans.latestMetricPlan.length).toBeGreaterThan(0);
    expect(plans.usageAggregatePlan.length).toBeGreaterThan(0);
    expect(plans.latestMetricPlan.toLowerCase()).toMatch(/index|scan/);
    expect(plans.usageAggregatePlan.toLowerCase()).toMatch(/scan/);
  });
});
