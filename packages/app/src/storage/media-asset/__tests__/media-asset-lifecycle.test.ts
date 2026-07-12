import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    deleteWhere: vi.fn(),
    fileDelete: vi.fn(),
    fileDownload: vi.fn(),
    fileExists: vi.fn(),
    fileHead: vi.fn(),
    fileSignedUploadUrl: vi.fn(),
    getFilesClient: vi.fn(),
    insertValues: vi.fn(),
    isObjectStorageEnabled: vi.fn(),
    markOtherLinkedAvatarsReplaced: vi.fn(),
    resolveStoredObjectUrl: vi.fn(),
    selectLimit: vi.fn(),
    unlink: vi.fn(),
    updateSet: vi.fn(),
    updateWhere: vi.fn()
  };
});

vi.mock("node:fs/promises", () => {
  return {
    mkdir: vi.fn(),
    rename: vi.fn(),
    unlink: mocks.unlink,
    writeFile: vi.fn()
  };
});

vi.mock("drizzle-orm", () => {
  return { and: vi.fn(), eq: vi.fn() };
});

vi.mock("@saasweave/db", () => {
  return {
    db: {
      delete: () => {
        return { where: mocks.deleteWhere };
      },
      insert: () => {
        return { values: mocks.insertValues };
      },
      select: () => {
        return {
          from: () => {
            return {
              where: () => {
                return { limit: mocks.selectLimit };
              }
            };
          }
        };
      },
      update: () => {
        return {
          set: (value: unknown) => {
            mocks.updateSet(value);
            return { where: mocks.updateWhere };
          }
        };
      }
    },
    markOtherLinkedAvatarsReplaced: mocks.markOtherLinkedAvatarsReplaced
  };
});

vi.mock("@saasweave/db/schema", () => {
  return { mediaAsset: { id: {}, ownerId: {} } };
});

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      BETTER_AUTH_SECRET: "unit-test-secret-at-least-32-characters",
      MEDIA_UPLOAD_DIR: "/tmp/saasweave-media-unit",
      VITE_SERVER_URL: "http://localhost:5000/server"
    }
  };
});

vi.mock("#@/storage/files-client", () => {
  return {
    getFilesClient: mocks.getFilesClient,
    isObjectStorageEnabled: mocks.isObjectStorageEnabled,
    resolveStoredObjectUrl: mocks.resolveStoredObjectUrl
  };
});

import {
  assertAvatarUpload,
  completeMediaAssetUpload,
  createMediaAssetUpload,
  deleteMediaAssetObject,
  finalizeAvatarReplacement,
  getPendingMediaUploadRow,
  resolveMediaUploadMaxBytes,
  verifyUploadToken
} from "#@/storage/media-asset/index";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const pendingRow = {
  contentType: "image/png",
  id: "asset-1",
  key: "avatar/user-1/image.png",
  ownerId: "user-1",
  purpose: "avatar",
  size: PNG_BYTES.byteLength,
  status: "pending"
};

function objectFiles() {
  return {
    delete: mocks.fileDelete,
    download: mocks.fileDownload,
    exists: mocks.fileExists,
    head: mocks.fileHead,
    signedUploadUrl: mocks.fileSignedUploadUrl
  };
}

describe("media upload lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteWhere.mockResolvedValue(undefined);
    mocks.fileDelete.mockResolvedValue(undefined);
    mocks.fileExists.mockResolvedValue(true);
    mocks.fileHead.mockResolvedValue({ size: PNG_BYTES.byteLength, type: "image/png" });
    mocks.fileSignedUploadUrl.mockResolvedValue({ method: "PUT", url: "https://storage.test/put" });
    mocks.getFilesClient.mockReturnValue(null);
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.isObjectStorageEnabled.mockReturnValue(false);
    mocks.markOtherLinkedAvatarsReplaced.mockResolvedValue(undefined);
    mocks.resolveStoredObjectUrl.mockResolvedValue("https://cdn.test/avatar/user-1/image.png");
    mocks.selectLimit.mockResolvedValue([pendingRow]);
    mocks.unlink.mockResolvedValue(undefined);
    mocks.updateWhere.mockResolvedValue(undefined);
  });

  it("creates a local upload contract with a valid asset-bound token", async () => {
    const result = await createMediaAssetUpload({
      contentType: "image/png",
      fileName: "avatar.png",
      ownerId: "user-1",
      purpose: "avatar",
      size: PNG_BYTES.byteLength
    });

    expect(result.contract.method).toBe("PUT");
    const contractUrl = new URL(result.contract.url);
    const assetId = result.mediaAssetId;
    const token = contractUrl.searchParams.get("token") ?? "";
    expect(verifyUploadToken(assetId, token)).toBe(true);
    expect(verifyUploadToken("different-asset", token)).toBe(false);
    expect(verifyUploadToken(assetId, `${token}tampered`)).toBe(false);
    expect(verifyUploadToken(assetId, "malformed")).toBe(false);
    expect(mocks.insertValues).toHaveBeenCalledOnce();
  });

  it("uses the object-storage signed upload contract when configured", async () => {
    mocks.getFilesClient.mockReturnValue(objectFiles());

    const result = await createMediaAssetUpload({
      contentType: "image/png",
      fileName: "avatar.png",
      ownerId: "user-1",
      purpose: "avatar",
      size: PNG_BYTES.byteLength
    });

    expect(result.contract).toEqual({ method: "PUT", url: "https://storage.test/put" });
    expect(mocks.fileSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^avatar\/user-1\/.+\.png$/),
      expect.objectContaining({ contentType: "image/png", maxSize: PNG_BYTES.byteLength })
    );
  });

  it("returns only pending upload rows and applies purpose-specific size limits", async () => {
    await expect(getPendingMediaUploadRow("asset-1")).resolves.toMatchObject({ status: "pending" });
    mocks.selectLimit.mockResolvedValueOnce([{ ...pendingRow, status: "linked" }]);
    await expect(getPendingMediaUploadRow("asset-1")).resolves.toBeNull();
    mocks.selectLimit.mockResolvedValueOnce([]);
    await expect(getPendingMediaUploadRow("missing")).resolves.toBeNull();

    expect(resolveMediaUploadMaxBytes({ purpose: "avatar", size: 9_000_000 })).toBe(2_000_000);
    expect(resolveMediaUploadMaxBytes({ purpose: "private", size: 9_000_000 })).toBe(8_000_000);
    expect(resolveMediaUploadMaxBytes({ purpose: "private", size: 10 })).toBe(10);
  });

  it("completes an already-uploaded local asset and rejects a pending local asset", async () => {
    mocks.selectLimit.mockResolvedValueOnce([{ ...pendingRow, status: "orphan" }]);
    await expect(
      completeMediaAssetUpload({ assetId: "asset-1", ownerId: "user-1" })
    ).resolves.toEqual({
      key: pendingRow.key,
      url: "https://cdn.test/avatar/user-1/image.png"
    });
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "linked" }));

    mocks.selectLimit.mockResolvedValueOnce([pendingRow]);
    await expect(
      completeMediaAssetUpload({ assetId: "asset-1", ownerId: "user-1" })
    ).resolves.toBeNull();
    mocks.selectLimit.mockResolvedValueOnce([]);
    await expect(
      completeMediaAssetUpload({ assetId: "missing", ownerId: "user-1" })
    ).resolves.toBeNull();
  });

  it("validates object metadata and avatar bytes before linking", async () => {
    mocks.getFilesClient.mockReturnValue(objectFiles());
    mocks.fileDownload.mockResolvedValue({
      arrayBuffer: async () => PNG_BYTES.buffer
    });

    await expect(
      completeMediaAssetUpload({ assetId: "asset-1", ownerId: "user-1" })
    ).resolves.toEqual({
      key: pendingRow.key,
      url: "https://cdn.test/avatar/user-1/image.png"
    });
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "orphan" }));
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "linked" }));

    mocks.fileExists.mockResolvedValueOnce(false);
    await expect(
      completeMediaAssetUpload({ assetId: "asset-1", ownerId: "user-1" })
    ).resolves.toBeNull();
    mocks.fileHead.mockResolvedValueOnce({ size: PNG_BYTES.byteLength, type: "image/jpeg" });
    await expect(
      completeMediaAssetUpload({ assetId: "asset-1", ownerId: "user-1" })
    ).resolves.toBeNull();
    mocks.fileHead.mockResolvedValueOnce({ size: 2_000_001, type: "image/png" });
    await expect(
      completeMediaAssetUpload({ assetId: "asset-1", ownerId: "user-1" })
    ).resolves.toBeNull();
    mocks.fileDownload.mockResolvedValueOnce({
      arrayBuffer: async () => new Uint8Array(PNG_BYTES.byteLength).buffer
    });
    await expect(
      completeMediaAssetUpload({ assetId: "asset-1", ownerId: "user-1" })
    ).resolves.toBeNull();
  });

  it("deletes local and object-storage assets and tolerates missing rows", async () => {
    await deleteMediaAssetObject("asset-1", "user-1");
    expect(mocks.unlink).toHaveBeenCalledWith("/tmp/saasweave-media-unit/avatar/user-1/image.png");
    expect(mocks.deleteWhere).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    mocks.getFilesClient.mockReturnValue(objectFiles());
    mocks.selectLimit.mockResolvedValueOnce([pendingRow]);
    await deleteMediaAssetObject("asset-1", "user-1");
    expect(mocks.fileDelete).toHaveBeenCalledWith(pendingRow.key);

    mocks.selectLimit.mockResolvedValueOnce([]);
    await expect(deleteMediaAssetObject("missing", "user-1")).resolves.toBeUndefined();
  });

  it("enforces avatar policy and delegates replacement finalization", async () => {
    expect(() => assertAvatarUpload({ contentType: "image/png", size: 1 })).not.toThrow();
    expect(() => assertAvatarUpload({ contentType: "text/plain", size: 1 })).toThrow(
      "Avatar must be a JPEG, PNG, or WebP image."
    );
    expect(() => assertAvatarUpload({ contentType: "image/png", size: 2_000_001 })).toThrow(
      "Avatar must be 2 MB or smaller."
    );

    await finalizeAvatarReplacement("user-1", "asset-1");
    expect(mocks.markOtherLinkedAvatarsReplaced).toHaveBeenCalledWith("user-1", "asset-1");
  });
});
