import { describe, expect, it } from "vite-plus/test";

import { resolvePlatformAdminRoleWithPolicy } from "#@/platform-policy";

describe("resolvePlatformAdminRoleWithPolicy", () => {
  it("promotes allow-listed emails to admin", () => {
    expect(
      resolvePlatformAdminRoleWithPolicy("ops@example.com", false, {
        adminEmails: ["ops@example.com"],
        isProduction: true
      })
    ).toBe("admin");
  });

  it("only auto-promotes the first user outside production when no allow-list exists", () => {
    expect(
      resolvePlatformAdminRoleWithPolicy("founder@example.com", true, {
        adminEmails: [],
        isProduction: false
      })
    ).toBe("admin");
    expect(
      resolvePlatformAdminRoleWithPolicy("second@example.com", false, {
        adminEmails: [],
        isProduction: false
      })
    ).toBe("user");
  });

  it("does not auto-promote the first user in production", () => {
    expect(
      resolvePlatformAdminRoleWithPolicy("founder@example.com", true, {
        adminEmails: [],
        isProduction: true
      })
    ).toBe("user");
  });
});
