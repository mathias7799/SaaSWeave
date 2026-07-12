import { describe, expect, it } from "vite-plus/test";

import { canImpersonateWorkspaceMember } from "#@/impersonation-policy";

describe("canImpersonateWorkspaceMember", () => {
  it("allows owners to impersonate non-owner members", () => {
    expect(
      canImpersonateWorkspaceMember({
        actorOrgRole: "owner",
        actorUserId: "actor-1",
        targetOrgRole: "developer",
        targetUserId: "target-1"
      })
    ).toEqual({ allowed: true });
  });

  it("blocks self-impersonation and owner targets", () => {
    expect(
      canImpersonateWorkspaceMember({
        actorOrgRole: "owner",
        actorUserId: "same",
        targetOrgRole: "member",
        targetUserId: "same"
      }).allowed
    ).toBe(false);

    expect(
      canImpersonateWorkspaceMember({
        actorOrgRole: "owner",
        actorUserId: "actor-1",
        targetOrgRole: "owner",
        targetUserId: "target-1"
      }).allowed
    ).toBe(false);
  });

  it("blocks admins from impersonating other admins or platform admins", () => {
    expect(
      canImpersonateWorkspaceMember({
        actorOrgRole: "admin",
        actorUserId: "actor-1",
        targetOrgRole: "admin",
        targetUserId: "target-1"
      }).allowed
    ).toBe(false);

    expect(
      canImpersonateWorkspaceMember({
        actorOrgRole: "owner",
        actorUserId: "actor-1",
        targetOrgRole: "member",
        targetPlatformRole: "admin",
        targetUserId: "target-1"
      }).allowed
    ).toBe(false);
  });

  it("blocks non-manager roles from impersonating members", () => {
    expect(
      canImpersonateWorkspaceMember({
        actorOrgRole: "developer",
        actorUserId: "actor-1",
        targetOrgRole: "member",
        targetUserId: "target-1"
      })
    ).toEqual({
      allowed: false,
      reason: "Only workspace owners and admins can impersonate members."
    });
  });
});
