import { describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    constructed: [] as unknown[],
    minio: vi.fn((options: unknown) => {
      return { adapterOptions: options };
    }),
    url: vi.fn(async (key: string) => `https://storage.test/${key}`)
  };
});

vi.mock("files-sdk", () => {
  return {
    Files: class MockFiles {
      url = mocks.url;

      constructor(options: unknown) {
        mocks.constructed.push(options);
      }
    }
  };
});
vi.mock("files-sdk/minio", () => {
  return { minio: mocks.minio };
});
vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      MEDIA_PUBLIC_BASE_URL: "http://localhost/media/",
      MINIO_ACCESS_KEY_ID: "access",
      MINIO_BUCKET: "uploads",
      MINIO_ENDPOINT: "http://minio:9000",
      MINIO_PUBLIC_BASE_URL: "https://cdn.test/uploads",
      MINIO_SECRET_ACCESS_KEY: "secret"
    }
  };
});

import {
  getFilesClient,
  getPrivateFilesClient,
  hasCompleteMinioConfig,
  isObjectStorageEnabled,
  resolveStoredObjectUrl
} from "#@/storage/files-client";

describe("configured files client", () => {
  it("validates complete object-storage configuration", () => {
    expect(
      hasCompleteMinioConfig({
        MINIO_ACCESS_KEY_ID: "access",
        MINIO_BUCKET: "uploads",
        MINIO_ENDPOINT: "http://minio:9000",
        MINIO_SECRET_ACCESS_KEY: "secret"
      })
    ).toBe(true);
    expect(
      hasCompleteMinioConfig({
        MINIO_ACCESS_KEY_ID: "",
        MINIO_BUCKET: "uploads",
        MINIO_ENDPOINT: "http://minio:9000",
        MINIO_SECRET_ACCESS_KEY: "secret"
      })
    ).toBe(false);
    expect(isObjectStorageEnabled()).toBe(true);
  });

  it("memoizes distinct public and private clients", () => {
    const publicClient = getFilesClient();
    expect(publicClient).toBe(getFilesClient());
    const privateClient = getPrivateFilesClient();
    expect(privateClient).toBe(getPrivateFilesClient());
    expect(privateClient).not.toBe(publicClient);
    expect(mocks.constructed).toHaveLength(2);
    expect(mocks.minio).toHaveBeenCalledWith(
      expect.objectContaining({ publicBaseUrl: "https://cdn.test/uploads" })
    );
    expect(mocks.minio).toHaveBeenCalledWith(
      expect.not.objectContaining({ publicBaseUrl: expect.anything() })
    );
  });

  it("resolves configured object URLs through files-sdk", async () => {
    await expect(resolveStoredObjectUrl("avatar/user/a.png")).resolves.toBe(
      "https://storage.test/avatar/user/a.png"
    );
    expect(mocks.url).toHaveBeenCalledWith("avatar/user/a.png");
  });
});
