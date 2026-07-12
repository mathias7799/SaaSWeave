import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    deleteDataExportRequest: vi.fn(),
    deleteMediaAssetObject: vi.fn(),
    deleteMediaAssetRow: vi.fn(),
    expiredOrphans: vi.fn(),
    expiredPending: vi.fn(),
    expiredReadyExports: vi.fn(),
    fileDelete: vi.fn(),
    getFilesClient: vi.fn(),
    isObjectStorageEnabled: vi.fn(),
    localRows: [] as Array<{ id: string; key: string }>,
    logInfo: vi.fn(),
    recordAudit: vi.fn(),
    replacedAvatars: vi.fn(),
    staleFailedExports: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn()
  };
});

vi.mock("node:fs/promises", () => {
  return { stat: mocks.stat, unlink: mocks.unlink };
});
vi.mock("drizzle-orm", () => {
  return { inArray: vi.fn() };
});
vi.mock("@saasweave/db/schema", () => {
  return { mediaAsset: { id: {}, key: {}, status: {} } };
});
vi.mock("@saasweave/db", () => {
  return {
    db: {
      select: () => {
        return {
          from: () => {
            return {
              where: () => {
                return { limit: async () => mocks.localRows };
              }
            };
          }
        };
      }
    },
    deleteDataExportRequest: mocks.deleteDataExportRequest,
    deleteMediaAssetRow: mocks.deleteMediaAssetRow,
    listExpiredOrphanUploadAssetIds: mocks.expiredOrphans,
    listExpiredPendingUploadAssetIds: mocks.expiredPending,
    listExpiredReadyExportIds: mocks.expiredReadyExports,
    listReplacedAvatarAssetIds: mocks.replacedAvatars,
    listStaleFailedExportIds: mocks.staleFailedExports,
    recordAudit: mocks.recordAudit
  };
});
vi.mock("@saasweave/env/server/env", () => {
  return { ENV_SERVER: { MEDIA_UPLOAD_DIR: "/tmp/saasweave-cleanup" } };
});
vi.mock("@saasweave/logger/server", () => {
  return {
    createLogger: () => {
      return { info: mocks.logInfo };
    }
  };
});
vi.mock("#@/storage/files-client", () => {
  return {
    getFilesClient: mocks.getFilesClient,
    isObjectStorageEnabled: mocks.isObjectStorageEnabled
  };
});
vi.mock("#@/storage/media-asset/index", () => {
  return { deleteMediaAssetObject: mocks.deleteMediaAssetObject };
});

import {
  deleteDataExportObject,
  runDataExportCleanup,
  runMediaLifecycleCleanup
} from "#@/storage/media-cleanup";

describe("storage lifecycle cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteDataExportRequest.mockResolvedValue(undefined);
    mocks.deleteMediaAssetObject.mockResolvedValue(undefined);
    mocks.deleteMediaAssetRow.mockResolvedValue(undefined);
    mocks.expiredOrphans.mockResolvedValue([]);
    mocks.expiredPending.mockResolvedValue([]);
    mocks.expiredReadyExports.mockResolvedValue([]);
    mocks.getFilesClient.mockReturnValue(null);
    mocks.isObjectStorageEnabled.mockReturnValue(false);
    mocks.localRows = [];
    mocks.recordAudit.mockResolvedValue(undefined);
    mocks.replacedAvatars.mockResolvedValue([]);
    mocks.staleFailedExports.mockResolvedValue([]);
    mocks.stat.mockRejectedValue(new Error("missing"));
    mocks.unlink.mockResolvedValue(undefined);
  });

  it("purges expired media and reconciles missing local objects", async () => {
    mocks.expiredPending.mockResolvedValue(["pending-1"]);
    mocks.expiredOrphans.mockResolvedValue([{ id: "orphan-1", key: "avatar/user/o.png" }]);
    mocks.replacedAvatars.mockResolvedValue([{ id: "avatar-1", ownerId: "user-1" }]);
    mocks.localRows = [
      { id: "missing-1", key: "avatar/user/missing.png" },
      { id: "unsafe-1", key: "../unsafe.png" }
    ];

    await expect(runMediaLifecycleCleanup()).resolves.toEqual({
      expiredPendingUploads: 1,
      missingObjectRows: 1,
      orphanedUploads: 1,
      replacedAvatars: 1
    });
    expect(mocks.unlink).toHaveBeenCalledWith("/tmp/saasweave-cleanup/avatar/user/o.png");
    expect(mocks.deleteMediaAssetObject).toHaveBeenCalledWith("avatar-1", "user-1");
    expect(mocks.deleteMediaAssetRow).toHaveBeenCalledWith("missing-1");
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "media.cleanup.completed" })
    );
  });

  it("skips local reconciliation under object storage and avoids empty audits", async () => {
    mocks.isObjectStorageEnabled.mockReturnValue(true);
    mocks.localRows = [{ id: "missing-1", key: "avatar/user/missing.png" }];

    await expect(runMediaLifecycleCleanup()).resolves.toEqual({
      expiredPendingUploads: 0,
      missingObjectRows: 0,
      orphanedUploads: 0,
      replacedAvatars: 0
    });
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("deletes expired export objects before rows and audits changes", async () => {
    mocks.expiredReadyExports.mockResolvedValue([
      { fileKey: "exports/org/one.ndjson", id: "ready-1" },
      { fileKey: null, id: "ready-2" }
    ]);
    mocks.staleFailedExports.mockResolvedValue(["failed-1"]);

    await expect(runDataExportCleanup()).resolves.toEqual({
      expiredExports: 2,
      failedExports: 1
    });
    expect(mocks.unlink).toHaveBeenCalledWith("/tmp/saasweave-cleanup/exports/org/one.ndjson");
    expect(mocks.deleteDataExportRequest).toHaveBeenCalledTimes(3);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "data_export.cleanup.completed" })
    );
  });

  it("uses object storage deletion and rejects unsafe local keys", async () => {
    mocks.getFilesClient.mockReturnValue({ delete: mocks.fileDelete });
    mocks.fileDelete.mockResolvedValue(undefined);
    await deleteDataExportObject("exports/org/one.ndjson");
    expect(mocks.fileDelete).toHaveBeenCalledWith("exports/org/one.ndjson");

    mocks.getFilesClient.mockReturnValue(null);
    await expect(deleteDataExportObject("../unsafe.ndjson")).rejects.toThrow(
      "invalid_export_storage_key"
    );
  });

  it("tolerates missing local export files but propagates other filesystem failures", async () => {
    mocks.unlink.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
    await expect(deleteDataExportObject("exports/org/missing.ndjson")).resolves.toBeUndefined();

    mocks.unlink.mockRejectedValueOnce(
      Object.assign(new Error("permission denied"), { code: "EACCES" })
    );
    await expect(deleteDataExportObject("exports/org/denied.ndjson")).rejects.toThrow(
      "permission denied"
    );
  });
});
