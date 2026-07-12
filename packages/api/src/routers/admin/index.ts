import { z } from "zod";

import { getPlatformAuditLog } from "@saasweave/db";

import { adminProcedure } from "#@/lib/procedures/factory";
import { adminCatalogRouter } from "#@/routers/admin/catalog";
import { buildAdminWorkspaces, buildPlatformStats } from "#@/routers/admin/data";
import { adminEmailsRouter } from "#@/routers/admin/emails";
import { adminSettingsRouter } from "#@/routers/admin/settings";
import { adminWorkspacesRouter } from "#@/routers/admin/workspaces";

/**
 * Admin router — the platform operator's unified view across every customer
 * workspace: revenue analytics, the workspace roster, and feature adoption.
 *
 * All procedures use `adminProcedure`, which requires the platform-admin role
 * (Better Auth admin plugin). Grant it via PLATFORM_ADMIN_EMAILS or the
 * first-user fallback in the auth config.
 */
export const adminRouter = {
  platformStats: adminProcedure
    .route({
      description: "Platform-wide revenue, retention, and plan-distribution analytics",
      method: "GET"
    })
    .handler(() => buildPlatformStats()),

  workspaces: {
    list: adminProcedure
      .route({
        description:
          "Cursor-paginated roster of customer workspaces with plan, seats, MRR, and status",
        method: "GET"
      })
      .input(z.object({ cursor: z.string().optional() }))
      .handler(({ input }) => buildAdminWorkspaces(input)),
    detail: adminWorkspacesRouter.detail,
    updatePlan: adminWorkspacesRouter.updatePlan
  },

  auditLog: adminProcedure
    .route({
      description: "Platform-wide audit trail of security- and billing-relevant actions",
      method: "GET"
    })
    .handler(() => getPlatformAuditLog({ limit: 60 })),

  emails: adminEmailsRouter,
  features: adminCatalogRouter.features,
  plans: adminCatalogRouter.plans,
  settings: adminSettingsRouter
};
