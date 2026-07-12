import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("files-sdk", () => {
  return { Files: vi.fn() };
});
vi.mock("files-sdk/minio", () => {
  return { minio: vi.fn() };
});
vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      MEDIA_PUBLIC_BASE_URL: "http://localhost/media/",
      MINIO_ACCESS_KEY_ID: "",
      MINIO_BUCKET: "",
      MINIO_ENDPOINT: "",
      MINIO_PUBLIC_BASE_URL: "",
      MINIO_SECRET_ACCESS_KEY: ""
    }
  };
});

import {
  getFilesClient,
  getPrivateFilesClient,
  isObjectStorageEnabled,
  resolveStoredObjectUrl
} from "#@/storage/files-client";

describe("disabled files client", () => {
  it("memoizes disabled clients as null", () => {
    expect(isObjectStorageEnabled()).toBe(false);
    expect(getFilesClient()).toBeNull();
    expect(getFilesClient()).toBeNull();
    expect(getPrivateFilesClient()).toBeNull();
    expect(getPrivateFilesClient()).toBeNull();
  });

  it("uses the normalized local public media URL", async () => {
    await expect(resolveStoredObjectUrl("avatar/user/a.png")).resolves.toBe(
      "http://localhost/media/avatar/user/a.png"
    );
  });
});
