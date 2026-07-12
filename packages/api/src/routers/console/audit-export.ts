import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { checkRateLimit, resolveSecurityFailureMode } from "@saasweave/cache";
import { AUDIT_EXPORT_FORMATS } from "@saasweave/core/audit";
import { exportOrganizationAudit, recordAudit } from "@saasweave/db";

import { isFeatureEnabledForOrg } from "#@/lib/features";
import { requireFeature } from "#@/lib/procedures/factory";

const auditExportProcedure = requireFeature("audit_logs");

export const auditExportRouter = {
  export: auditExportProcedure
    .route({
      description: "Export workspace audit events as CSV or JSON",
      method: "POST"
    })
    .input(
      z.object({
        format: z.enum(AUDIT_EXPORT_FORMATS),
        since: z.string().datetime().optional(),
        until: z.string().datetime().optional()
      })
    )
    .handler(async ({ context, input }) => {
      const exportEnabled = await isFeatureEnabledForOrg(context.organization.id, "audit_export");
      if (!exportEnabled) {
        throw new ORPCError("FORBIDDEN", {
          message: "Audit export is not enabled for this workspace."
        });
      }

      const rateKey = `audit-export:${context.organization.id}:${context.session.user.id}`;
      const rate = await checkRateLimit(rateKey, 3, 3_600, {
        failureMode: resolveSecurityFailureMode()
      });
      if (!rate.allowed) {
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: `Export rate limit exceeded. Try again in ${rate.retryAfterSeconds} seconds.`
        });
      }

      const exported = await exportOrganizationAudit({
        format: input.format,
        organizationId: context.organization.id,
        since: input.since ? new Date(input.since) : undefined,
        until: input.until ? new Date(input.until) : undefined
      });

      await recordAudit({
        action: "audit_log.exported",
        actorId: context.session.user.id,
        actorName: context.session.user.name,
        metadata: { format: input.format, rowCount: exported.rowCount },
        organizationId: context.organization.id,
        targetType: "audit_log"
      });

      return exported;
    })
};
