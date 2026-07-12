/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper, which the jest lint plugin cannot trace */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganization,
  seedOrgWithOwner,
  seedPlatformAdmin
} from "./harness";

describe.sequential("session auth matrix", () => {
  integrationIt("console.overview rejects callers without a session (UNAUTHORIZED)", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await createCallerFor({ seed, session: null });

    await expectOrpcError(() => caller.console.overview(), "UNAUTHORIZED");
  });

  integrationIt(
    "console.team resolves to the caller membership when active org is foreign (no FORBIDDEN)",
    async () => {
      const seed = await seedOrgWithOwner({ organizationName: "Home workspace" });
      const foreign = await seedOrganization({ name: "Foreign workspace" });
      const caller = await createCallerFor({ organizationId: foreign.organizationId, seed });

      const team = await caller.console.team();

      expect(team.organizationId).toBe(seed.organizationId);
      expect(team.organizationId).not.toBe(foreign.organizationId);
    }
  );

  integrationIt("console.team allows an organization member", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await createCallerFor({ seed });

    const team = await caller.console.team();

    expect(team.organizationId).toBe(seed.organizationId);
  });

  integrationIt("admin.platformStats rejects non-admin sessions (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await createCallerFor({ seed });

    await expectOrpcError(() => caller.admin.platformStats(), "FORBIDDEN");
  });

  integrationIt("admin.platformStats allows platform-admin sessions", async () => {
    const seed = await seedOrgWithOwner();
    await seedPlatformAdmin(seed.userId);
    const caller = await createCallerFor({ seed, userRole: "admin" });

    const stats = await caller.admin.platformStats();

    expect(stats.totalWorkspaces).toBeGreaterThanOrEqual(1);
  });
});
