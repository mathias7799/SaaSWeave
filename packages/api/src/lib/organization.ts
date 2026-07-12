import { eq, sql } from "drizzle-orm";

import { type AuthSession } from "@saasweave/auth/index";
import { provisionPersonalWorkspace } from "@saasweave/auth/provision-workspace";
import { db } from "@saasweave/db";
import { member, organization } from "@saasweave/db/schema";

import { planName, planSeats } from "#@/lib/plans";

export type ActiveOrganization = { id: string; role: string };

export type OrgSeatContext = {
  planId: string | null;
  planName: string;
  seatsUsed: number;
  seatsIncluded: number;
};

/** Real seat usage + plan-derived allowance for an organization. */
export async function getOrgSeatContext(organizationId: string): Promise<OrgSeatContext> {
  const [orgRow] = await db
    .select({ planId: organization.planId })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(member)
    .where(eq(member.organizationId, organizationId));
  const planId = orgRow?.planId ?? null;
  const [resolvedName, resolvedSeats] = await Promise.all([planName(planId), planSeats(planId)]);
  return {
    planId,
    planName: resolvedName,
    seatsIncluded: resolvedSeats,
    seatsUsed: Number(countRow?.count ?? 0)
  };
}

/**
 * Resolve the caller's active organization + their role in it.
 *
 * Prefers the session's active organization, falls back to the user's first
 * membership, and self-heals by creating a personal organization if the user
 * somehow has none (e.g. accounts created before tenancy existed).
 */
export async function resolveActiveOrganization(session: AuthSession): Promise<ActiveOrganization> {
  const userId = session.user.id;
  const activeId = session.session.activeOrganizationId;

  const memberships = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, userId));

  if (activeId) {
    const active = memberships.find((entry) => entry.organizationId === activeId);
    if (active) return { id: active.organizationId, role: active.role };
  }

  if (memberships[0]) {
    return { id: memberships[0].organizationId, role: memberships[0].role };
  }

  const organizationId = await provisionPersonalWorkspace({
    email: session.user.email,
    id: userId,
    name: session.user.name
  });
  return { id: organizationId, role: "owner" };
}
