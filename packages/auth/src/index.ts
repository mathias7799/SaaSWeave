import { join } from "node:path/posix";

import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { sso } from "@better-auth/sso";
import "@tanstack/react-start/server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { admin, magicLink, openAPI, organization, twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { db, isFeatureGloballyEnabled, recordAudit } from "@saasweave/db";
import * as schema from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { dispatchNotification, dispatchTemplateEmail } from "@saasweave/jobs/dispatch";
import { dispatchOrgWebhook } from "@saasweave/jobs/webhook-dispatch";

import { roles } from "#@/permissions";
import {
  assertSeatAvailable,
  assertSignupsOpen,
  resolvePlatformAdminRole
} from "#@/platform-policy";
import { workspaceImpersonation } from "#@/plugins/workspace-impersonation";
import { provisionPersonalWorkspace } from "#@/provision-workspace";

const WEB_URL = ENV_SERVER.VITE_WEB_URL;

export { provisionPersonalWorkspace, slugify } from "#@/provision-workspace";

export const auth = betterAuth({
  baseURL: new URL(ENV_SERVER.VITE_SERVER_URL).origin,
  basePath: join(new URL(ENV_SERVER.VITE_SERVER_URL).pathname, "auth"),
  trustedOrigins: [new URL(ENV_SERVER.VITE_WEB_URL).origin],
  secret: ENV_SERVER.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema
  }),

  // https://www.better-auth.com/docs/concepts/session-management#session-caching
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  },

  // https://www.better-auth.com/docs/authentication/email-password
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: ENV_SERVER.REQUIRE_EMAIL_VERIFICATION,
    sendResetPassword: async ({ user, url }) => {
      const firstName = user.name.split(" ")[0] || user.name;
      await dispatchTemplateEmail({
        key: "password-reset",
        to: user.email,
        values: { actionUrl: url, name: firstName }
      });
    }
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const firstName = user.name.split(" ")[0] || user.name;
      await dispatchTemplateEmail({
        key: "welcome",
        to: user.email,
        values: { actionUrl: url, name: firstName }
      });
    }
  },

  socialProviders: {
    ...(ENV_SERVER.GOOGLE_CLIENT_ID && ENV_SERVER.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: ENV_SERVER.GOOGLE_CLIENT_ID,
            clientSecret: ENV_SERVER.GOOGLE_CLIENT_SECRET
          }
        }
      : {}),
    ...(ENV_SERVER.GITHUB_CLIENT_ID && ENV_SERVER.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: ENV_SERVER.GITHUB_CLIENT_ID,
            clientSecret: ENV_SERVER.GITHUB_CLIENT_SECRET
          }
        }
      : {})
  },

  experimental: {
    // https://www.better-auth.com/docs/adapters/drizzle#joins-experimental
    joins: true
  },

  databaseHooks: {
    session: {
      create: {
        after: async (sessionData) => {
          const impersonatedBy = sessionData.impersonatedBy;
          if (!impersonatedBy || typeof impersonatedBy !== "string") return;

          const [actor] = await db
            .select({ name: schema.user.name, role: schema.user.role })
            .from(schema.user)
            .where(eq(schema.user.id, impersonatedBy))
            .limit(1);
          if (actor?.role !== "admin") return;

          const [target] = await db
            .select({ email: schema.user.email })
            .from(schema.user)
            .where(eq(schema.user.id, sessionData.userId))
            .limit(1);
          if (!target) return;

          await recordAudit({
            action: "user.impersonated",
            actorId: impersonatedBy,
            actorName: actor.name,
            metadata: { targetUserId: sessionData.userId },
            targetLabel: target.email,
            targetType: "user"
          });
        },
        // Start each session in the user's first organization. Falls back to
        // provisioning it here if the user-create `after` hook hasn't landed
        // yet (see provisionPersonalWorkspace).
        before: async (sessionData) => {
          if (sessionData.impersonatedBy && sessionData.activeOrganizationId) {
            return { data: sessionData };
          }

          const membership = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, sessionData.userId))
            .limit(1);
          if (membership[0]) {
            return { data: { ...sessionData, activeOrganizationId: membership[0].organizationId } };
          }
          const user = await db
            .select({ email: schema.user.email, id: schema.user.id, name: schema.user.name })
            .from(schema.user)
            .where(eq(schema.user.id, sessionData.userId))
            .limit(1);
          if (!user[0]) return;
          const organizationId = await provisionPersonalWorkspace(user[0]);
          return { data: { ...sessionData, activeOrganizationId: organizationId } };
        }
      }
    },
    user: {
      create: {
        // Grant the platform-admin role to allow-listed emails, or to the very
        // first user when no allow-list is configured (template convenience).
        before: async (userData) => {
          await assertSignupsOpen();
          const existing = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
          const isFirstUser = existing.length === 0;
          const role = resolvePlatformAdminRole(userData.email, isFirstUser);
          return { data: { ...userData, role } };
        },
        // Every new user gets a personal organization they own.
        after: async (userData) => {
          await provisionPersonalWorkspace(userData);
        }
      }
    }
  },

  plugins: [
    magicLink({
      expiresIn: 600,
      sendMagicLink: async ({ email, url }) => {
        const enabled = await isFeatureGloballyEnabled("magic_link");
        if (!enabled) {
          throw new APIError("FORBIDDEN", {
            message: "Magic link sign-in is not enabled on this platform."
          });
        }
        await dispatchTemplateEmail({
          key: "magic-link",
          to: email,
          values: { actionUrl: url, name: "there" }
        });
      }
    }),
    organization({
      creatorRole: "owner",
      roles,
      sendInvitationEmail: async (data) => {
        await dispatchTemplateEmail({
          key: "invitation",
          meta: { organizationId: data.organization.id },
          to: data.email,
          values: {
            acceptUrl: `${WEB_URL}/accept-invite?id=${data.id}`,
            inviterName: data.inviter.user.name,
            workspaceName: data.organization.name
          }
        });
      },
      organizationHooks: {
        beforeCreateInvitation: async ({ organization: org }) => {
          await assertSeatAvailable(org.id);
        },
        afterCancelInvitation: async ({ invitation, organization: org }) => {
          await recordAudit({
            action: "invitation.cancelled",
            organizationId: org.id,
            targetLabel: invitation.email,
            targetType: "invitation"
          });
        },
        afterCreateInvitation: async ({ invitation, inviter, organization: org }) => {
          await recordAudit({
            action: "invitation.sent",
            actorId: inviter.id,
            actorName: inviter.name,
            metadata: { role: invitation.role },
            organizationId: org.id,
            targetLabel: invitation.email,
            targetType: "invitation"
          });
        },
        afterCreateOrganization: async ({ organization: org, user }) => {
          await recordAudit({
            action: "workspace.created",
            actorId: user.id,
            actorName: user.name,
            organizationId: org.id,
            targetLabel: org.name,
            targetType: "organization"
          });
        },
        afterUpdateOrganization: async ({ organization: org, user }) => {
          if (!org) return;
          await recordAudit({
            action: "workspace.updated",
            actorId: user.id,
            actorName: user.name,
            organizationId: org.id,
            targetLabel: org.name,
            targetType: "organization"
          });
        },
        afterDeleteOrganization: async ({ organization: org, user }) => {
          await recordAudit({
            action: "workspace.deleted",
            actorId: user.id,
            actorName: user.name,
            targetLabel: org.name,
            targetType: "organization"
          });
        },
        afterAddMember: async ({ member, user, organization: org }) => {
          await recordAudit({
            action: "member.added",
            actorName: user.name,
            metadata: { role: member.role },
            organizationId: org.id,
            targetLabel: user.email,
            targetType: "member"
          });
          await dispatchNotification({
            actionUrl: `${WEB_URL}/app/team`,
            audience: { excludeUserId: member.userId, kind: "org", organizationId: org.id },
            organizationId: org.id,
            title: `${user.name} joined the workspace`,
            type: "member.added"
          });
          void dispatchOrgWebhook(org.id, "member.added", {
            email: user.email,
            role: member.role,
            userId: member.userId
          });
        },
        afterUpdateMemberRole: async ({ member, user, organization: org }) => {
          await recordAudit({
            action: "member.role_updated",
            metadata: { role: member.role },
            organizationId: org.id,
            targetLabel: user.email,
            targetType: "member"
          });
          await dispatchNotification({
            actionUrl: `${WEB_URL}/app/team`,
            audience: { kind: "user", userId: member.userId },
            organizationId: org.id,
            title: `Your role is now ${member.role}`,
            type: "member.role_updated"
          });
        },
        afterRemoveMember: async ({ user, organization: org }) => {
          await recordAudit({
            action: "member.removed",
            organizationId: org.id,
            targetLabel: user.email,
            targetType: "member"
          });
          void dispatchOrgWebhook(org.id, "member.removed", {
            email: user.email,
            userId: user.id
          });
        }
      }
    }),
    twoFactor({
      issuer: "SaaSWeave"
    }),
    sso({
      organizationProvisioning: {
        defaultRole: "member",
        disabled: false
      }
    }),
    admin({
      adminRoles: ["admin"],
      defaultRole: "user",
      impersonationSessionDuration: 60 * 60
    }),
    workspaceImpersonation(),
    openAPI({
      theme: "deepSpace"
    })
  ],

  telemetry: {
    enabled: false
  }
});

export type AuthSession = typeof auth.$Infer.Session;
