import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { checkRateLimit, resolveSecurityFailureMode } from "@saasweave/cache";
import {
  createDataExportRequest,
  getDataExportRequest,
  listDataExportRequests,
  recordAudit
} from "@saasweave/db";

import { dispatchDataExport } from "#@/lib/data-export/dispatch";
import { resolveAuthorizedDataExportDownload } from "#@/lib/data-export/download";
import { isFeatureEnabledForOrg } from "#@/lib/features";
import { requireFeature } from "#@/lib/procedures/factory";

const dataExportProcedure = requireFeature("data_export");

const exportRequestSchema = z.object({
  canDownload: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  error: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  id: z.string(),
  status: z.enum(["pending", "processing", "ready", "failed", "canceled"])
});

function assertCanRequestDataExport(role: string) {
  if (!["owner", "admin"].includes(role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only workspace owners and admins can request a data export."
    });
  }
}

function shapeExportRequest(row: Awaited<ReturnType<typeof getDataExportRequest>>) {
  if (!row) return null;

  const canDownload =
    row.status === "ready" &&
    Boolean(row.fileKey) &&
    !row.downloadRevokedAt &&
    (!row.expiresAt || new Date(row.expiresAt) > new Date());

  return exportRequestSchema.parse({
    canDownload,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    error: row.error,
    expiresAt: row.expiresAt,
    id: row.id,
    status: row.status
  });
}

export const dataExportRouter = {
  request: dataExportProcedure
    .route({
      description: "Request a full workspace data export (owner/admin only)",
      method: "POST"
    })
    .handler(async ({ context }) => {
      assertCanRequestDataExport(context.organization.role);

      const exportEnabled = await isFeatureEnabledForOrg(context.organization.id, "data_export");
      if (!exportEnabled) {
        throw new ORPCError("FORBIDDEN", {
          message: "Data export is not enabled for this workspace."
        });
      }

      const rateKey = `data-export:${context.organization.id}:${context.session.user.id}`;
      const rate = await checkRateLimit(rateKey, 3, 3_600, {
        failureMode: resolveSecurityFailureMode()
      });
      if (!rate.allowed) {
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: `Export rate limit exceeded. Try again in ${rate.retryAfterSeconds} seconds.`
        });
      }

      const created = await createDataExportRequest({
        organizationId: context.organization.id,
        requestedByUserId: context.session.user.id
      });

      await recordAudit({
        action: "data_export.requested",
        actorId: context.session.user.id,
        actorName: context.session.user.name,
        metadata: { requestId: created.id },
        organizationId: context.organization.id,
        targetLabel: created.id,
        targetType: "data_export_request"
      });

      void dispatchDataExport(created.id);

      return exportRequestSchema.parse({
        canDownload: false,
        completedAt: created.completedAt,
        createdAt: created.createdAt,
        error: created.error,
        expiresAt: created.expiresAt,
        id: created.id,
        status: created.status
      });
    }),

  list: dataExportProcedure
    .route({
      description: "List recent workspace data export requests",
      method: "GET"
    })
    .handler(async ({ context }) => {
      const rows = await listDataExportRequests(context.organization.id);
      return rows.map((row) => shapeExportRequest(row)).filter((row) => row !== null);
    }),

  get: dataExportProcedure
    .route({
      description: "Get a workspace data export request",
      method: "GET"
    })
    .input(z.object({ id: z.string().min(1) }))
    .errors({
      EXPORT_NOT_FOUND: { description: "No such export on this workspace", status: 404 }
    })
    .handler(async ({ context, errors, input }) => {
      const row = await getDataExportRequest(context.organization.id, input.id);
      if (!row) throw errors.EXPORT_NOT_FOUND();
      const shaped = shapeExportRequest(row);
      if (!shaped) throw errors.EXPORT_NOT_FOUND();
      return shaped;
    }),

  download: dataExportProcedure
    .route({
      description: "Resolve an authenticated export download URL",
      method: "POST"
    })
    .input(z.object({ id: z.string().min(1) }))
    .errors({
      EXPORT_NOT_FOUND: { description: "No such export on this workspace", status: 404 },
      EXPORT_NOT_READY: { description: "Export is not ready for download", status: 400 },
      EXPORT_EXPIRED: { description: "Export download has expired", status: 410 },
      FORBIDDEN: { description: "Caller cannot download this export", status: 403 }
    })
    .handler(async ({ context, errors, input }) => {
      try {
        const resolved = await resolveAuthorizedDataExportDownload(
          {
            organizationId: context.organization.id,
            role: context.organization.role,
            userId: context.session.user.id
          },
          input.id
        );

        await recordAudit({
          action: "data_export.download_authorized",
          actorId: context.session.user.id,
          actorName: context.session.user.name,
          metadata: { mode: resolved.mode, requestId: input.id },
          organizationId: context.organization.id,
          targetLabel: input.id,
          targetType: "data_export_request"
        });

        return {
          expiresAt: resolved.expiresAt,
          mode: resolved.mode,
          url: resolved.url
        };
      } catch (error) {
        if (error instanceof ORPCError) {
          if (error.code === "NOT_FOUND") throw errors.EXPORT_NOT_FOUND();
          if (error.code === "GONE") throw errors.EXPORT_EXPIRED();
          if (error.code === "FORBIDDEN") throw errors.FORBIDDEN();
          if (error.code === "BAD_REQUEST") throw errors.EXPORT_NOT_READY();
        }
        throw error;
      }
    })
};
