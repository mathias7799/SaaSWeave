import { describe, expect, it } from "vite-plus/test";

import { ac, ORG_MANAGER_ROLES, roles, type OrganizationRole } from "#@/permissions";

describe("permissions", () => {
  it("reuses Better Auth default access controller", () => {
    expect(ac).toBeDefined();
    expect(typeof ac.newRole).toBe("function");
  });

  it("defines product roles without org-management permissions", () => {
    for (const role of ["developer", "analyst", "billing"] as const) {
      expect(roles[role]).toBe(roles.developer);
    }
    expect(roles.owner).not.toBe(roles.member);
    expect(roles.admin).not.toBe(roles.member);
  });

  it("lists workspace manager roles used by impersonation policy", () => {
    const expected: OrganizationRole[] = ["owner", "admin"];
    expect(ORG_MANAGER_ROLES).toEqual(expected);
  });
});
