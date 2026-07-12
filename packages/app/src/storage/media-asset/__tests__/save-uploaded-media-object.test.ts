import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    mkdir: vi.fn(),
    rename: vi.fn(),
    selectLimit: vi.fn(),
    unlink: vi.fn(),
    updateWhere: vi.fn(),
    writeFile: vi.fn()
  };
});

vi.mock("node:fs/promises", () => {
  return {
    mkdir: mocks.mkdir,
    rename: mocks.rename,
    unlink: mocks.unlink,
    writeFile: mocks.writeFile
  };
});

vi.mock("drizzle-orm", () => {
  return {
    and: vi.fn(),
    eq: vi.fn()
  };
});

vi.mock("@saasweave/db", () => {
  return {
    db: {
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
          set: () => {
            return { where: mocks.updateWhere };
          }
        };
      }
    },
    markOtherLinkedAvatarsReplaced: vi.fn()
  };
});

vi.mock("@saasweave/db/schema", () => {
  return {
    mediaAsset: {
      id: {},
      ownerId: {}
    }
  };
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
    getFilesClient: vi.fn(() => null),
    isObjectStorageEnabled: vi.fn(() => false),
    resolveStoredObjectUrl: vi.fn()
  };
});

import { saveUploadedMediaObject } from "#@/storage/media-asset/index";

const VALID_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("saveUploadedMediaObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.rename.mockResolvedValue(undefined);
    mocks.unlink.mockResolvedValue(undefined);
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.selectLimit.mockResolvedValue([
      {
        contentType: "image/png",
        id: "asset-1",
        key: "avatar/user-1/image.png",
        ownerId: "user-1",
        purpose: "avatar",
        size: VALID_PNG.byteLength,
        status: "pending"
      }
    ]);
  });

  it("rejects a mismatched content type before writing", async () => {
    await expect(saveUploadedMediaObject("asset-1", VALID_PNG, "image/jpeg")).resolves.toBe(false);
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("rejects invalid avatar magic bytes before writing", async () => {
    const invalidPng = new Uint8Array(VALID_PNG.byteLength);

    await expect(saveUploadedMediaObject("asset-1", invalidPng, "image/png")).resolves.toBe(false);
    expect(mocks.mkdir).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
  });

  it("removes the partial file when atomic rename fails", async () => {
    mocks.rename.mockRejectedValueOnce(new Error("rename failed"));

    await expect(saveUploadedMediaObject("asset-1", VALID_PNG, "image/png")).resolves.toBe(false);
    expect(mocks.writeFile).toHaveBeenCalledOnce();
    const partialPath = mocks.writeFile.mock.calls[0]?.[0];
    expect(partialPath).toEqual(expect.stringContaining(".partial."));
    expect(mocks.rename).toHaveBeenCalledWith(
      partialPath,
      "/tmp/saasweave-media-unit/avatar/user-1/image.png"
    );
    expect(mocks.unlink).toHaveBeenCalledWith(partialPath);
    expect(mocks.updateWhere).not.toHaveBeenCalled();
  });
});
