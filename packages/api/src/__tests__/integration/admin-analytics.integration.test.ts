/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { randomUUID } from "node:crypto";

import { describe, expect } from "vite-plus/test";

import { recordAudit } from "@saasweave/db";
import { db } from "@saasweave/db";
import { mrrSnapshot } from "@saasweave/db/schema";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganizationPlan,
  seedOrgWithOwner,
  seedPlatformAdmin
} from "./harness";

async function seedAdminCaller(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedPlatformAdmin(seed.userId);
  return createCallerFor({ seed, userRole: "admin" });
}

describe.sequential("admin analytics", () => {
  integrationIt("platformStats returns KPIs with empty MRR snapshots", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    const stats = await caller.admin.platformStats();

    expect(stats.totalWorkspaces).toBeGreaterThanOrEqual(1);
    expect(stats.mrrTrendCollecting).toBe(true);
    expect(stats.kpis.length).toBeGreaterThanOrEqual(4);
    expect(stats.planDistribution.length).toBeGreaterThanOrEqual(1);
  });

  integrationIt("platformStats includes persisted MRR snapshot rows", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId, "growth");
    await db.insert(mrrSnapshot).values({
      activeOrgs: 1,
      churnedMrr: 0,
      currency: "usd",
      id: randomUUID(),
      mrr: 9900,
      newMrr: 9900,
      periodMonth: "2026-01"
    });
    const caller = await seedAdminCaller(seed);

    const stats = await caller.admin.platformStats();

    expect(stats.mrrTrend.some((point) => point.mrr === 9900)).toBe(true);
  });

  integrationIt("workspaces.list includes the seeded workspace", async () => {
    const seed = await seedOrgWithOwner({ organizationName: "Admin Listed Org" });
    await seedOrganizationPlan(seed.organizationId, "scale");
    const caller = await seedAdminCaller(seed);

    const roster = await caller.admin.workspaces.list({});

    expect(roster.workspaces.some((workspace) => workspace.id === seed.organizationId)).toBe(true);
  });

  integrationIt("workspaces.detail returns full workspace context", async () => {
    const seed = await seedOrgWithOwner({ organizationName: "Detail Org" });
    await seedOrganizationPlan(seed.organizationId, "growth");
    const caller = await seedAdminCaller(seed);

    const detail = await caller.admin.workspaces.detail({ id: seed.organizationId });

    expect(detail.id).toBe(seed.organizationId);
    expect(detail.name).toBe("Detail Org");
    expect(detail.owner?.email).toBe(seed.email);
    expect(detail.team.members).toHaveLength(1);
    expect(detail.features.length).toBeGreaterThan(0);
  });

  integrationIt("workspaces.detail returns WORKSPACE_NOT_FOUND for missing ids", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    await expectOrpcError(
      () => caller.admin.workspaces.detail({ id: "missing-workspace-id" }),
      "WORKSPACE_NOT_FOUND"
    );
  });

  integrationIt("workspaces.updatePlan changes the workspace plan", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    const updated = await caller.admin.workspaces.updatePlan({
      id: seed.organizationId,
      planId: "enterprise"
    });

    expect(updated).toEqual({ ok: true });
    const detail = await caller.admin.workspaces.detail({ id: seed.organizationId });
    expect(detail.plan.id).toBe("enterprise");
  });

  integrationIt("auditLog returns platform-wide audit entries", async () => {
    const seed = await seedOrgWithOwner();
    await recordAudit({
      action: "workspace.plan_changed",
      actorId: seed.userId,
      actorName: seed.name,
      metadata: { planId: "growth" },
      organizationId: seed.organizationId,
      targetLabel: "workspace",
      targetType: "organization"
    });
    const caller = await seedAdminCaller(seed);

    const audit = await caller.admin.auditLog();

    expect(audit.some((entry) => entry.action === "workspace.plan_changed")).toBe(true);
  });
});
