import {
  getDataExportRequestById,
  recordAudit,
  updateDataExportRequestStatus
} from "@saasweave/db";
import { createLogger } from "@saasweave/logger/server";
import { exportDurationSeconds, exportSizeBytes } from "@saasweave/observability";

import { computeDataExportExpiresAt } from "#@/data-export/storage";
import { DataExportLimitError, streamOrganizationDataExport } from "#@/data-export/stream-export";

const log = createLogger({ operation: "app__data_export" });

export type DataExportReadyNotification = {
  organizationId: string;
  requestedByUserId: string;
  requestId: string;
};

export type DataExportProcessResult =
  | { status: "missing" | "already_ready" | "canceled" }
  | { status: "failed"; requestId: string }
  | { status: "ready"; notify: DataExportReadyNotification };

export async function processDataExportRequest(
  requestId: string
): Promise<DataExportProcessResult> {
  const startedAt = performance.now();
  const request = await getDataExportRequestById(requestId);
  if (!request) {
    log.warn("Data export request not found", { event: "data_export_missing", requestId });
    return { status: "missing" };
  }

  if (request.status === "ready") {
    return { status: "already_ready" };
  }

  if (request.status === "canceled" || request.canceledAt) {
    return { status: "canceled" };
  }

  await updateDataExportRequestStatus(requestId, { status: "processing" });

  try {
    const streamed = await streamOrganizationDataExport({
      organizationId: request.organizationId,
      requestId
    });

    await updateDataExportRequestStatus(requestId, {
      bytesWritten: streamed.bytesWritten,
      checkpoint: null,
      completedAt: new Date(),
      expiresAt: computeDataExportExpiresAt(),
      fileKey: streamed.fileKey,
      rowsWritten: streamed.rowsWritten,
      status: "ready"
    });

    await recordAudit({
      action: "data_export.completed",
      actorId: request.requestedByUserId,
      metadata: {
        bytesWritten: streamed.bytesWritten,
        requestId,
        rowsWritten: streamed.rowsWritten
      },
      organizationId: request.organizationId,
      targetLabel: requestId,
      targetType: "data_export_request"
    });

    exportDurationSeconds.observe((performance.now() - startedAt) / 1000);
    exportSizeBytes.observe(streamed.bytesWritten);

    return {
      notify: {
        organizationId: request.organizationId,
        requestedByUserId: request.requestedByUserId,
        requestId
      },
      status: "ready"
    };
  } catch (error) {
    if (error instanceof DataExportLimitError && error.message === "export_canceled") {
      await updateDataExportRequestStatus(requestId, {
        completedAt: new Date(),
        status: "canceled"
      });
      return { status: "canceled" };
    }

    const message = error instanceof Error ? error.message : "export_failed";
    await updateDataExportRequestStatus(requestId, {
      completedAt: new Date(),
      error: message,
      status: "failed"
    });

    await recordAudit({
      action: "data_export.failed",
      actorId: request.requestedByUserId,
      metadata: { error: message, requestId },
      organizationId: request.organizationId,
      targetLabel: requestId,
      targetType: "data_export_request"
    });

    log.error(error instanceof Error ? error : String(error), {
      event: "data_export_failed",
      organizationId: request.organizationId,
      requestId
    });

    throw error;
  }
}
