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

describe.sequential("console billing usage overage", () => {
  integrationIt("billing estimate includes usage overage for high api call volume", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId, "scale");
    await seedOrganizationFeatureFlags(seed.organizationId, { billing_portal: true });
    await db.insert(usageEvent).values({
      createdAt: new Date(),
      id: randomUUID(),
      metric: "api_calls",
      organizationId: seed.organizationId,
      quantity: 600_000
    });
    const caller = await createCallerFor({ seed });

    const billing = await caller.console.billing();

    expect(billing.meteredLive).toBe(true);
    expect(billing.estimate.usageOverage).toBeGreaterThan(0);
    expect(billing.costByCategory.some((entry) => entry.category === "Usage overage")).toBe(true);
  });
});
