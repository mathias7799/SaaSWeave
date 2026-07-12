import { ORG_MANAGER_ROLES, type OrganizationRole } from "#@/permissions";

export const IMPERSONATION_SESSION_SECONDS = 60 * 60;

export function canImpersonateWorkspaceMember(input: {
  actorOrgRole: string;
  actorUserId: string;
  targetOrgRole: string;
  targetPlatformRole?: string | null;
  targetUserId: string;
}):
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
    } {
  if (input.actorUserId === input.targetUserId) {
    return { allowed: false, reason: "You cannot impersonate yourself." };
  }

  if (!ORG_MANAGER_ROLES.includes(input.actorOrgRole as OrganizationRole)) {
    return { allowed: false, reason: "Only workspace owners and admins can impersonate members." };
  }

  if (input.targetOrgRole === "owner") {
    return { allowed: false, reason: "Workspace owners cannot be impersonated." };
  }

  if (input.actorOrgRole === "admin" && input.targetOrgRole === "admin") {
    return { allowed: false, reason: "Admins cannot impersonate other admins." };
  }

  if (input.targetPlatformRole === "admin") {
    return {
      allowed: false,
      reason: "Platform admins cannot be impersonated from the workspace console."
    };
  }

  return { allowed: true };
}
