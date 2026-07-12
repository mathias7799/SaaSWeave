/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper, which the jest lint plugin cannot trace */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedIpAllowlistRule,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

describe.sequential("IP allowlist auth matrix", () => {
  async function seedAllowlistedOrg() {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, {
      ip_allowlist: true,
      team_management: true
    });
    return seed;
  }

  integrationIt("console.team allows a client IP matching an exact allowlist rule", async () => {
    const seed = await seedAllowlistedOrg();
    await seedIpAllowlistRule({
      cidr: "203.0.113.10",
      createdBy: seed.userId,
      organizationId: seed.organizationId
    });
    const caller = await createCallerFor({ clientIp: "203.0.113.10", seed });

    const team = await caller.console.team();

    expect(team.organizationId).toBe(seed.organizationId);
  });

  integrationIt("console.team rejects a client IP outside the allowlist (FORBIDDEN)", async () => {
    const seed = await seedAllowlistedOrg();
    await seedIpAllowlistRule({
      cidr: "203.0.113.10",
      createdBy: seed.userId,
      organizationId: seed.organizationId
    });
    const caller = await createCallerFor({ clientIp: "198.51.100.1", seed });

    await expectOrpcError(() => caller.console.team(), "FORBIDDEN");
  });

  integrationIt("console.team allows a client IP inside a configured CIDR range", async () => {
    const seed = await seedAllowlistedOrg();
    await seedIpAllowlistRule({
      cidr: "203.0.113.0/24",
      createdBy: seed.userId,
      organizationId: seed.organizationId
    });
    const caller = await createCallerFor({ clientIp: "203.0.113.42", seed });

    const team = await caller.console.team();

    expect(team.organizationId).toBe(seed.organizationId);
  });

  integrationIt("console.team bypasses IP allowlist while impersonating", async () => {
    const seed = await seedAllowlistedOrg();
    await seedIpAllowlistRule({
      cidr: "203.0.113.10",
      createdBy: seed.userId,
      organizationId: seed.organizationId
    });
    const caller = await createCallerFor({
      clientIp: "198.51.100.1",
      impersonatedBy: "platform-admin-user",
      seed
    });

    const team = await caller.console.team();

    expect(team.organizationId).toBe(seed.organizationId);
  });
});
