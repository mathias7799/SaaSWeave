/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import { createCallerFor, integrationIt, seedOrgWithOwner, seedPlatformAdmin } from "./harness";

async function seedAdminCaller(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedPlatformAdmin(seed.userId);
  return createCallerFor({ seed, userRole: "admin" });
}

describe.sequential("admin settings", () => {
  integrationIt("get returns the platform settings singleton", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    const settings = await caller.admin.settings.get();

    expect(settings.platformName).toBeTruthy();
    expect(settings.currency).toBeTruthy();
    expect(settings.signupsOpen).toBeTypeOf("boolean");
  });

  integrationIt("update patches platform settings and returns the merged row", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    await caller.admin.settings.get();
    const updated = await caller.admin.settings.update({
      platformName: "Integration Platform",
      supportEmail: "support@integration.test"
    });

    expect(updated.platformName).toBe("Integration Platform");
    expect(updated.supportEmail).toBe("support@integration.test");

    const current = await caller.admin.settings.get();
    expect(current.platformName).toBe("Integration Platform");
  });
});
