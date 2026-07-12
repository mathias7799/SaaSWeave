import { describe, expect, it } from "vite-plus/test";

import { hasCompleteMinioConfig } from "@saasweave/app/storage/files-client";

describe("hasCompleteMinioConfig", () => {
  const empty = {
    MINIO_ACCESS_KEY_ID: "",
    MINIO_BUCKET: "",
    MINIO_ENDPOINT: "",
    MINIO_SECRET_ACCESS_KEY: ""
  };

  it("returns false when any required field is missing", () => {
    expect(hasCompleteMinioConfig(empty)).toBe(false);
    expect(
      hasCompleteMinioConfig({
        ...empty,
        MINIO_BUCKET: "media",
        MINIO_ENDPOINT: "http://localhost:9000"
      })
    ).toBe(false);
  });

  it("returns true when all required fields are set", () => {
    expect(
      hasCompleteMinioConfig({
        MINIO_ACCESS_KEY_ID: "key",
        MINIO_BUCKET: "media",
        MINIO_ENDPOINT: "http://localhost:9000",
        MINIO_SECRET_ACCESS_KEY: "secret"
      })
    ).toBe(true);
  });
});
