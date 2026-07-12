import { APIError } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, recordAudit } from "@saasweave/db";
import { member, user as userTable } from "@saasweave/db/schema";

import {
  canImpersonateWorkspaceMember,
  IMPERSONATION_SESSION_SECONDS
} from "#@/impersonation-policy";

export async function handleImpersonateWorkspaceMember(ctx: {
  body: { organizationId?: string; userId: string };
  context: {
    authCookies: {
      dontRememberToken: { name: string };
      sessionToken: { attributes: Record<string, unknown> };
    };
    createAuthCookie: (name: string) => { name: string };
    internalAdapter: {
      createSession: (
        userId: string,
        remember: boolean,
        data: Record<string, unknown>,
        overwrite: boolean
      ) => Promise<{ token: string } | null>;
      findUserById: (
        userId: string
      ) => Promise<{ email: string; id: string; name?: string } | null>;
    };
    secret: string;
  };
  getSignedCookie: (name: string, secret: string) => Promise<string | null | undefined>;
  json: (payload: unknown) => unknown;
  setSignedCookie: (
    name: string,
    value: string,
    secret: string,
    attributes: Record<string, unknown>
  ) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}) {
  const actorSession = await getSessionFromCtx(ctx as never);
  if (!actorSession) {
    throw new APIError("UNAUTHORIZED");
  }

  if (actorSession.session.impersonatedBy) {
    throw new APIError("FORBIDDEN", {
      message: "Stop impersonating before starting a new session."
    });
  }

  const organizationId = ctx.body.organizationId ?? actorSession.session.activeOrganizationId;
  if (!organizationId) {
    throw new APIError("BAD_REQUEST", { message: "No active workspace." });
  }

  const [actorMember] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, actorSession.user.id)))
    .limit(1);
  if (!actorMember) {
    throw new APIError("FORBIDDEN", { message: "You are not a member of this workspace." });
  }

  const [targetMember] = await db
    .select({ role: member.role, userId: member.userId })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, ctx.body.userId)))
    .limit(1);
  if (!targetMember) {
    throw new APIError("NOT_FOUND", {
      message: "That user is not a member of this workspace."
    });
  }

  const [targetAccount] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, ctx.body.userId))
    .limit(1);

  const targetUser = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
  if (!targetUser) {
    throw new APIError("NOT_FOUND", { message: "User not found." });
  }

  const decision = canImpersonateWorkspaceMember({
    actorOrgRole: actorMember.role,
    actorUserId: actorSession.user.id,
    targetOrgRole: targetMember.role,
    targetPlatformRole: targetAccount?.role,
    targetUserId: targetMember.userId
  });
  if (!decision.allowed) {
    throw new APIError("FORBIDDEN", { message: decision.reason });
  }

  const session = await ctx.context.internalAdapter.createSession(
    targetUser.id,
    true,
    {
      activeOrganizationId: organizationId,
      expiresAt: new Date(Date.now() + IMPERSONATION_SESSION_SECONDS * 1000),
      impersonatedBy: actorSession.user.id
    },
    true
  );
  if (!session) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to create impersonation session."
    });
  }

  const authCookies = ctx.context.authCookies;
  deleteSessionCookie(ctx as never);
  const dontRememberMeCookie = await ctx.getSignedCookie(
    ctx.context.authCookies.dontRememberToken.name,
    ctx.context.secret
  );
  const adminCookieProp = ctx.context.createAuthCookie("admin_session");
  await ctx.setSignedCookie(
    adminCookieProp.name,
    `${actorSession.session.token}:${dontRememberMeCookie ?? ""}`,
    ctx.context.secret,
    authCookies.sessionToken.attributes
  );
  await setSessionCookie(ctx as never, { session, user: targetUser } as never, true);

  await recordAudit({
    action: "member.impersonated",
    actorId: actorSession.user.id,
    actorName: actorSession.user.name,
    metadata: { targetUserId: targetUser.id },
    organizationId,
    targetLabel: targetUser.email,
    targetType: "member"
  });

  return ctx.json({ session, user: targetUser });
}

export function workspaceImpersonation() {
  return {
    endpoints: {
      impersonateWorkspaceMember: createAuthEndpoint(
        "/workspace/impersonate",
        {
          body: z.object({
            organizationId: z.string().optional(),
            userId: z.string().min(1)
          }),
          method: "POST",
          requireHeaders: true,
          use: [sessionMiddleware]
        },
        handleImpersonateWorkspaceMember as never
      )
    },
    id: "workspace-impersonation"
  };
}
