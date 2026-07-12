import { beforeEach, describe, expect, it } from "vite-plus/test";

import { getPlatformSettings, getPublicPlatformSettings } from "@saasweave/db";

import { resetDb } from "./db-harness";

describe.sequential("platform-settings", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates default settings on first read and returns public subset", async () => {
    const settings = await getPlatformSettings();
    expect(settings.platformName).toBe("SaaSWeave");
    expect(settings.billingMode).toBe("hybrid");
    expect(settings.signupsOpen).toBe(true);

    const again = await getPlatformSettings();
    expect(again.platformName).toBe("SaaSWeave");

    const publicSettings = await getPublicPlatformSettings();
    expect(publicSettings).toEqual({
      maintenanceMode: settings.maintenanceMode,
      platformName: settings.platformName,
      signupsOpen: settings.signupsOpen,
      supportEmail: settings.supportEmail
    });
    expect(publicSettings).not.toHaveProperty("billingMode");
  });
});
