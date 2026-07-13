import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      MEDIA_UPLOAD_DIR: ".uploads",
      VITE_SERVER_URL: "http://localhost:5000/server"
    }
  };
});

describe("resolveAuthorizedDataExportDownload", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a signed URL when object storage is enabled", async () => {
    const filesClient = {
      url: vi.fn(async () => "https://minio.example/signed-export")
    };

    vi.doMock("@saasweave/app/storage/files-client", () => {
      return {
        getPrivateFilesClient: () => filesClient,
        isObjectStorageEnabled: () => true
      };
    });

    vi.doMock("@saasweave/db", () => {
      return {
        getEmailCopy: vi.fn(async () => null),
        getDataExportRequest: vi.fn(async () => {
          return {
            completedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            downloadRevokedAt: null,
            error: null,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            fileKey: "exports/org/export.json",
            id: "export-1",
            organizationId: "org-1",
            requestedByUserId: "user-1",
            status: "ready"
          };
        }),
        recordEmailDelivery: vi.fn(async () => undefined)
      };
    });

    const { resolveAuthorizedDataExportDownload } = await import("#@/lib/data-export/download");
    const resolved = await resolveAuthorizedDataExportDownload(
      { organizationId: "org-1", role: "owner", userId: "user-1" },
      "export-1"
    );

    expect(resolved.mode).toBe("signed");
    expect(resolved.url).toBe("https://minio.example/signed-export");
  });
});
