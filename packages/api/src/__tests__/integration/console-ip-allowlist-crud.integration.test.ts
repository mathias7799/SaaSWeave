/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
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

async function seedAllowlistFeature(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedOrganizationPlan(seed.organizationId);
  await seedOrganizationFeatureFlags(seed.organizationId, { ip_allowlist: true });
}

describe.sequential("console ipAllowlist CRUD", () => {
  integrationIt("create adds a rule and list returns it", async () => {
    const seed = await seedOrgWithOwner();
    await seedAllowlistFeature(seed);
    const caller = await createCallerFor({ seed });

    const created = await caller.console.ipAllowlist.create({
      cidr: "203.0.113.50",
      label: "Office"
    });

    expect(created.cidr).toBe("203.0.113.50");
    const listCaller = await createCallerFor({ clientIp: "203.0.113.50", seed });
    const rules = await listCaller.console.ipAllowlist.list();
    expect(rules).toEqual([expect.objectContaining({ cidr: "203.0.113.50", label: "Office" })]);
  });

  integrationIt("create rejects invalid CIDR values (BAD_REQUEST)", async () => {
    const seed = await seedOrgWithOwner();
    await seedAllowlistFeature(seed);
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.ipAllowlist.create({ cidr: "not-a-cidr" }),
      "BAD_REQUEST"
    );
  });

  integrationIt("delete removes a seeded rule", async () => {
    const seed = await seedOrgWithOwner();
    await seedAllowlistFeature(seed);
    const rule = await seedIpAllowlistRule({
      cidr: "198.51.100.10",
      createdBy: seed.userId,
      organizationId: seed.organizationId
    });
    const caller = await createCallerFor({ clientIp: "198.51.100.10", seed });

    const deleted = await caller.console.ipAllowlist.delete({ id: rule.id });
    expect(deleted).toEqual({ ok: true });
    expect(await caller.console.ipAllowlist.list()).toEqual([]);
  });

  integrationIt("delete returns RULE_NOT_FOUND for unknown ids", async () => {
    const seed = await seedOrgWithOwner();
    await seedAllowlistFeature(seed);
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.ipAllowlist.delete({ id: "missing-rule" }),
      "RULE_NOT_FOUND"
    );
  });

  integrationIt("create rejects members without allowlist access (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner({ role: "member" });
    await seedAllowlistFeature(seed);
    const caller = await createCallerFor({ seed, role: "member" });

    await expectOrpcError(
      () => caller.console.ipAllowlist.create({ cidr: "203.0.113.1" }),
      "FORBIDDEN"
    );
  });
});
