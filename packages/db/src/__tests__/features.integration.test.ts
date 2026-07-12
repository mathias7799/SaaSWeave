import { beforeEach, describe, expect, it } from "vite-plus/test";

import { isFeatureGloballyEnabled } from "@saasweave/db";

import { resetDb, seedFeatureFlag } from "./db-harness";

describe.sequential("features", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns false for unknown flags and true when enabled in catalog", async () => {
    expect(await isFeatureGloballyEnabled("nonexistent.feature.key")).toBe(false);

    await seedFeatureFlag("webhooks", true);
    expect(await isFeatureGloballyEnabled("webhooks")).toBe(true);

    await seedFeatureFlag("webhooks", false);
    expect(await isFeatureGloballyEnabled("webhooks")).toBe(false);
  });
});
