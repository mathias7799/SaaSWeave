import { describe, expect, it, vi } from "vite-plus/test";

import { type DataExportRequestRow } from "@saasweave/db";

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      MEDIA_UPLOAD_DIR: ".uploads",
      VITE_SERVER_URL: "http://localhost:5000/server"
    }
  };
});

vi.mock("@saasweave/app/storage/files-client", () => {
  return {
    getPrivateFilesClient: () => null,
    isObjectStorageEnabled: () => false
  };
});

const {
  assertCanDownloadDataExport,
  buildSessionDataExportDownloadUrl,
  resolveDataExportDownloadTtlSeconds
} = await import("#@/lib/data-export/download");

describe("assertCanDownloadDataExport", () => {
  const baseRow: DataExportRequestRow = {
    bytesWritten: 1_024,
    canceledAt: null,
    checkpoint: null,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    downloadRevokedAt: null,
    error: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    fileKey: "exports/org/export.json",
    format: "ndjson",
    id: "export-1",
    organizationId: "org-1",
    requestedByUserId: "user-1",
    rowsWritten: 10,
    status: "ready"
  };

  it("allows owner download for ready exports", () => {
    expect(() =>
      assertCanDownloadDataExport(
        { organizationId: "org-1", role: "owner", userId: "user-1" },
        baseRow
      )
    ).not.toThrow();
  });

  it("rejects member role downloads", () => {
    expect(() =>
      assertCanDownloadDataExport(
        { organizationId: "org-1", role: "member", userId: "user-1" },
        baseRow
      )
    ).toThrow("Only workspace owners and admins can download a data export.");
  });

  it("rejects cross-tenant, incomplete, revoked, and expired exports", () => {
    const owner = { organizationId: "org-1", role: "owner", userId: "user-1" };
    expect(() =>
      assertCanDownloadDataExport(owner, { ...baseRow, organizationId: "org-2" })
    ).toThrow("Export does not belong to this workspace.");
    expect(() =>
      assertCanDownloadDataExport(owner, { ...baseRow, fileKey: null, status: "processing" })
    ).toThrow("Export is not ready for download.");
    expect(() =>
      assertCanDownloadDataExport(owner, {
        ...baseRow,
        downloadRevokedAt: new Date().toISOString()
      })
    ).toThrow("Export download has been revoked.");
    expect(() =>
      assertCanDownloadDataExport(owner, {
        ...baseRow,
        expiresAt: new Date(Date.now() - 1).toISOString()
      })
    ).toThrow("Export download has expired.");
  });

  it("builds base-path URLs and caps signed URL lifetime", () => {
    expect(buildSessionDataExportDownloadUrl("export-1")).toBe(
      "http://localhost:5000/server/exports/export-1/download"
    );
    expect(resolveDataExportDownloadTtlSeconds({ ...baseRow, expiresAt: null }, 0)).toBe(900);
    expect(
      resolveDataExportDownloadTtlSeconds(
        { ...baseRow, expiresAt: new Date(60_000).toISOString() },
        0
      )
    ).toBe(60);
    expect(
      resolveDataExportDownloadTtlSeconds({ ...baseRow, expiresAt: new Date(-1).toISOString() }, 0)
    ).toBe(1);
  });
});
