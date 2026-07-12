import { adminAc, defaultAc, memberAc, ownerAc } from "better-auth/plugins/organization/access";

/**
 * Organization roles for SaaSWeave, mapped to the roles shown in the Team UI.
 *
 * `owner`/`admin`/`member` reuse Better Auth's built-in permission sets.
 * `developer`, `analyst`, and `billing` are product roles: they are full org
 * members but hold no org-management permissions (they cannot invite or remove
 * members). Grant them finer permissions here as the product needs them.
 */
const productRole = defaultAc.newRole({
  ac: [],
  invitation: [],
  member: [],
  organization: [],
  team: []
});

export const ac = defaultAc;

export const roles = {
  admin: adminAc,
  analyst: productRole,
  billing: productRole,
  developer: productRole,
  member: memberAc,
  owner: ownerAc
};

export type OrganizationRole = keyof typeof roles;

/** Roles that can manage members and billing from the console. */
export const ORG_MANAGER_ROLES: OrganizationRole[] = ["owner", "admin"];
