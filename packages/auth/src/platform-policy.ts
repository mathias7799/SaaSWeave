import { APIError } from "better-auth/api";
import { and, eq, sql } from "drizzle-orm";
import { isProduction } from "std-env";

import { db, getPlatformSettings } from "@saasweave/db";
import * as schema from "@saasweave/db/schema";
import { plan } from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";

const adminEmails = ENV_SERVER.PLATFORM_ADMIN_EMAILS.split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function resolvePlatformAdminRoleWithPolicy(
  email: string,
  isFirstUser: boolean,
  policy: { adminEmails: string[]; isProduction: boolean }
): "admin" | "user" {
  const normalized = email.toLowerCase();
  if (policy.adminEmails.includes(normalized)) return "admin";
  if (!policy.isProduction && policy.adminEmails.length === 0 && isFirstUser) return "admin";
  return "user";
}

export function resolvePlatformAdminRole(email: string, isFirstUser: boolean): "admin" | "user" {
  return resolvePlatformAdminRoleWithPolicy(email, isFirstUser, {
    adminEmails,
    isProduction
  });
}

export async function assertSignupsOpen(): Promise<void> {
  const settings = await getPlatformSettings();
  if (!settings.signupsOpen) {
    throw new APIError("FORBIDDEN", {
      message: "New sign-ups are currently closed."
    });
  }
}

async function countSeats(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.member)
    .where(eq(schema.member.organizationId, organizationId));
  return Number(row?.count ?? 0);
}

async function seatsIncluded(organizationId: string): Promise<number> {
  const [org] = await db
    .select({ planId: schema.organization.planId })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  if (!org?.planId) return 1;
  const [planRow] = await db
    .select({ seatsIncluded: plan.seatsIncluded })
    .from(plan)
    .where(eq(plan.id, org.planId))
    .limit(1);
  return planRow?.seatsIncluded ?? 1;
}

export async function assertSeatAvailable(organizationId: string): Promise<void> {
  const [seatsUsed, included] = await Promise.all([
    countSeats(organizationId),
    seatsIncluded(organizationId)
  ]);
  if (seatsUsed >= included) {
    throw new APIError("FORBIDDEN", {
      message: `This workspace has reached its seat limit (${included}). Upgrade your plan to invite more members.`
    });
  }

  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.invitation)
    .where(
      and(
        eq(schema.invitation.organizationId, organizationId),
        eq(schema.invitation.status, "pending")
      )
    );
  const pendingCount = Number(pending?.count ?? 0);
  if (seatsUsed + pendingCount >= included) {
    throw new APIError("FORBIDDEN", {
      message: "This workspace has no open seats for new invitations."
    });
  }
}
