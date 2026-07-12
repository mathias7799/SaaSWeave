/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { randomUUID } from "node:crypto";

import { describe, expect } from "vite-plus/test";

import { recordAudit } from "@saasweave/db";
import { db } from "@saasweave/db";
import { invitation } from "@saasweave/db/schema";

import {
  createCallerFor,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

async function seedConsoleBasics(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedOrganizationPlan(seed.organizationId, "scale");
  await seedOrganizationFeatureFlags(seed.organizationId, {
    audit_logs: true,
    team_management: true
  });
}

describe.sequential("console overview and features", () => {
  integrationIt("overview returns headline metrics for the seeded workspace", async () => {
    const seed = await seedOrgWithOwner({ organizationName: "Overview Labs" });
    await seedConsoleBasics(seed);
    const caller = await createCallerFor({ seed });

    const overview = await caller.console.overview();

    expect(overview.plan.name).toBeTruthy();
    expect(overview.metrics.length).toBeGreaterThanOrEqual(4);
    expect(overview.trend).toHaveLength(30);
    expect(overview.activity).toEqual([]);
  });

  integrationIt("features lists entitlements for the workspace plan", async () => {
    const seed = await seedOrgWithOwner();
    await seedConsoleBasics(seed);
    const caller = await createCallerFor({ seed });

    const features = await caller.console.features();

    expect(features.length).toBeGreaterThan(0);
    expect(features.some((entry) => entry.key === "team_management")).toBe(true);
  });

  integrationIt("auditLog returns workspace activity after seeding audit rows", async () => {
    const seed = await seedOrgWithOwner();
    await seedConsoleBasics(seed);
    await recordAudit({
      action: "settings.updated",
      actorId: seed.userId,
      actorName: seed.name,
      organizationId: seed.organizationId,
      targetLabel: "workspace",
      targetType: "organization"
    });
    const caller = await createCallerFor({ seed });

    const audit = await caller.console.auditLog();

    expect(audit.length).toBe(1);
    expect(audit[0]?.action).toBe("settings.updated");
  });
});

describe.sequential("console team", () => {
  integrationIt("returns the seeded workspace roster for the owner", async () => {
    const seed = await seedOrgWithOwner({
      email: "ada@analytical-engines.test",
      name: "Ada Lovelace",
      organizationName: "Analytical Engines"
    });
    await seedOrganizationFeatureFlags(seed.organizationId, { team_management: true });
    const caller = await createCallerFor({ seed });
    const team = await caller.console.team();

    expect(team.organizationId).toBe(seed.organizationId);
    expect(team.seatsUsed).toBe(1);
    expect(team.members).toHaveLength(1);
    expect(team.members[0]).toMatchObject({
      email: seed.email,
      name: seed.name,
      role: "owner",
      userId: seed.userId
    });
  });

  integrationIt("includes pending invitations in the team response", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationFeatureFlags(seed.organizationId, { team_management: true });
    const inviteId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(invitation).values({
      email: "invitee@integration.test",
      expiresAt,
      id: inviteId,
      inviterId: seed.userId,
      organizationId: seed.organizationId,
      role: "member",
      status: "pending"
    });
    const caller = await createCallerFor({ seed });

    const team = await caller.console.team();

    expect(team.pendingInvites).toBe(1);
    expect(team.invitations).toEqual([
      expect.objectContaining({
        email: "invitee@integration.test",
        id: inviteId,
        role: "member"
      })
    ]);
  });
});
