import { describe, expect, it } from "vite-plus/test";

import { getConsoleNav } from "@/features/console-nav/config/console-nav.config";
import {
  collectEnabledFeatureKeys,
  filterConsoleNavByFeatures
} from "@/features/console-nav/lib/filter-console-nav";

describe("filterConsoleNavByFeatures", () => {
  it("hides nav items when their feature is disabled", () => {
    const filtered = filterConsoleNavByFeatures(getConsoleNav(), new Set(["api_keys"]));
    const paths = filtered.flatMap((group) => group.items.map((item) => item.to));

    expect(paths).toContain("/app/api-keys");
    expect(paths).not.toContain("/app/webhooks");
    expect(paths).not.toContain("/app/features");
    expect(paths).not.toContain("/app/billing");
    expect(paths).not.toContain("/app/team");
    expect(paths).not.toContain("/app/notifications");
    expect(paths).not.toContain("/app/security");
  });

  it("shows gated nav items when their feature keys are enabled", () => {
    const filtered = filterConsoleNavByFeatures(
      getConsoleNav(),
      new Set(["billing_portal", "team_management", "notifications", "two_factor", "audit_logs"])
    );
    const paths = filtered.flatMap((group) => group.items.map((item) => item.to));

    expect(paths).toContain("/app/billing");
    expect(paths).toContain("/app/team");
    expect(paths).toContain("/app/notifications");
    expect(paths).toContain("/app/security");
    expect(paths).toContain("/app/audit");
  });

  it("collects enabled feature keys", () => {
    const keys = collectEnabledFeatureKeys([
      { enabledForOrg: true, key: "api_keys" },
      { enabledForOrg: false, key: "webhooks" }
    ]);

    expect(keys.has("api_keys")).toBe(true);
    expect(keys.has("webhooks")).toBe(false);
  });
});
