import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { ORPCError } from "@orpc/server";

import { getPrivateFilesClient, isObjectStorageEnabled } from "@saasweave/app/storage/files-client";
import { type AuthSession } from "@saasweave/auth/index";
import {
  DATA_EXPORT_DOWNLOAD_TTL_SECONDS,
  MAX_DATA_EXPORT_DOWNLOAD_BYTES
} from "@saasweave/core/data-export/constants";
import { resolveSafeMediaPath } from "@saasweave/core/media-asset";
import {
  type DataExportRequestRow,
  getDataExportRequest,
  getDataExportRequestById
} from "@saasweave/db";
import { ENV_SERVER } from "@saasweave/env/server/env";

import { resolveActiveOrganization } from "#@/lib/organization";

export type DataExportDownloadContext = {
  organizationId: string;
  role: string;
  userId: string;
};

function mapDownloadError(error: unknown): Response {
  if (error instanceof ORPCError) {
    const status =
      error.status ??
      (error.code === "FORBIDDEN"
        ? 403
        : error.code === "NOT_FOUND"
          ? 404
          : error.code === "GONE"
            ? 410
            : 400);
    return new Response(JSON.stringify({ error: error.code, message: error.message }), {
      headers: { "Content-Type": "application/json" },
      status
    });
  }

  return new Response(JSON.stringify({ error: "INTERNAL_SERVER_ERROR" }), {
    headers: { "Content-Type": "application/json" },
    status: 500
  });
}

export function assertCanDownloadDataExport(
  context: DataExportDownloadContext,
  row: DataExportRequestRow
): void {
  if (!["owner", "admin"].includes(context.role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only workspace owners and admins can download a data export."
    });
  }

  if (row.organizationId !== context.organizationId) {
    throw new ORPCError("FORBIDDEN", { message: "Export does not belong to this workspace." });
  }

  if (row.status !== "ready" || !row.fileKey) {
    throw new ORPCError("BAD_REQUEST", { message: "Export is not ready for download." });
  }

  if (row.downloadRevokedAt) {
    throw new ORPCError("FORBIDDEN", { message: "Export download has been revoked." });
  }

  if (row.expiresAt && new Date(row.expiresAt) <= new Date()) {
    throw new ORPCError("GONE", { message: "Export download has expired." });
  }
}

export function buildSessionDataExportDownloadUrl(exportId: string): string {
  const base = new URL(ENV_SERVER.VITE_SERVER_URL);
  return `${base.origin}${base.pathname.replace(/\/$/, "")}/exports/${exportId}/download`;
}

export function resolveDataExportDownloadTtlSeconds(
  row: DataExportRequestRow,
  now = Date.now()
): number {
  if (!row.expiresAt) return DATA_EXPORT_DOWNLOAD_TTL_SECONDS;
  const remainingSeconds = Math.floor((new Date(row.expiresAt).getTime() - now) / 1_000);
  return Math.max(1, Math.min(DATA_EXPORT_DOWNLOAD_TTL_SECONDS, remainingSeconds));
}

export async function resolveAuthorizedDataExportDownload(
  context: DataExportDownloadContext,
  exportId: string
): Promise<{ expiresAt: string | null; mode: "session" | "signed"; url: string }> {
  const row = await getDataExportRequest(context.organizationId, exportId);
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Export not found." });
  }

  assertCanDownloadDataExport(context, row);

  const files = getPrivateFilesClient();
  if (files && row.fileKey) {
    const expiresIn = resolveDataExportDownloadTtlSeconds(row);
    const url = await files.url(row.fileKey, {
      expiresIn,
      responseContentDisposition: `attachment; filename="export-${exportId}.ndjson"`
    });
    return {
      expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
      mode: "signed",
      url
    };
  }

  return {
    expiresAt: row.expiresAt,
    mode: "session",
    url: buildSessionDataExportDownloadUrl(exportId)
  };
}

export async function handleSessionDataExportDownload(input: {
  exportId: string;
  session: AuthSession;
}): Promise<Response> {
  try {
    const organization = await resolveActiveOrganization(input.session);
    const row = await getDataExportRequestById(input.exportId);
    if (!row || row.organizationId !== organization.id) {
      throw new ORPCError("NOT_FOUND", { message: "Export not found." });
    }

    assertCanDownloadDataExport(
      {
        organizationId: organization.id,
        role: organization.role,
        userId: input.session.user.id
      },
      row
    );

    const files = getPrivateFilesClient();
    if (files && row.fileKey) {
      const expiresIn = resolveDataExportDownloadTtlSeconds(row);
      const signedUrl = await files.url(row.fileKey, {
        expiresIn,
        responseContentDisposition: `attachment; filename="export-${input.exportId}.ndjson"`
      });
      return new Response(null, {
        headers: {
          "Cache-Control": "private, no-store",
          Location: signedUrl,
          "X-Content-Type-Options": "nosniff"
        },
        status: 302
      });
    }

    if (!row.fileKey || isObjectStorageEnabled()) {
      throw new ORPCError("NOT_FOUND", { message: "Export file is unavailable." });
    }

    const absolutePath = resolveSafeMediaPath(ENV_SERVER.MEDIA_UPLOAD_DIR, row.fileKey);
    if (!absolutePath) {
      throw new ORPCError("NOT_FOUND", { message: "Export file is unavailable." });
    }

    const fileStat = await stat(absolutePath).catch(() => null);
    if (!fileStat?.isFile()) {
      throw new ORPCError("NOT_FOUND", { message: "Export file is unavailable." });
    }

    if (fileStat.size > MAX_DATA_EXPORT_DOWNLOAD_BYTES) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Export file exceeds the download size limit."
      });
    }

    const stream = Readable.toWeb(createReadStream(absolutePath)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="export-${input.exportId}.ndjson"`,
        "Content-Length": String(fileStat.size),
        "Content-Type": "application/x-ndjson",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return mapDownloadError(error);
  }
}
