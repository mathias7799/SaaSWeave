import { mkdir, rm, writeFile } from "node:fs/promises";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getMediaAssetByKey = vi.fn();

vi.mock("@saasweave/app/storage/media-asset", () => {
  return {
    getPendingMediaUploadRow: vi.fn(),
    resolveMediaUploadMaxBytes: vi.fn(),
    saveUploadedMediaObject: vi.fn(),
    verifyUploadToken: vi.fn()
  };
});

vi.mock("@saasweave/db", () => {
  return {
    getMediaAssetByKey
  };
});

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      MEDIA_UPLOAD_DIR: "/tmp/uploads"
    }
  };
});

describe("media public route", () => {
  beforeAll(async () => {
    await mkdir("/tmp/uploads/avatar/user", { recursive: true });
    await writeFile("/tmp/uploads/avatar/user/file.png", new Uint8Array([1, 2, 3]));
  });

  afterAll(async () => {
    await rm("/tmp/uploads/avatar", { force: true, recursive: true });
  });
  beforeEach(() => {
    vi.resetModules();
    getMediaAssetByKey.mockReset();
  });

  it("returns 404 for path traversal keys", async () => {
    const { mediaRoutes } = await import("#@/routes/media");
    const response = await mediaRoutes.request("http://localhost/avatar/../../etc/passwd");
    expect(response.status).toBe(404);
  });

  it("returns 404 for orphan avatars", async () => {
    getMediaAssetByKey.mockResolvedValue({
      contentType: "image/png",
      purpose: "avatar",
      replacedAt: null,
      status: "orphan"
    });

    const { mediaRoutes } = await import("#@/routes/media");
    const response = await mediaRoutes.request("http://localhost/avatar/user/file.png");
    expect(response.status).toBe(404);
  });

  it("returns 404 for linked non-avatar purposes", async () => {
    getMediaAssetByKey.mockResolvedValue({
      contentType: "application/pdf",
      purpose: "attachment",
      replacedAt: null,
      status: "linked"
    });

    const { mediaRoutes } = await import("#@/routes/media");
    const response = await mediaRoutes.request("http://localhost/document/user/file.pdf");
    expect(response.status).toBe(404);
  });

  it("streams linked public media with immutable headers", async () => {
    getMediaAssetByKey.mockResolvedValue({
      contentType: "image/png",
      purpose: "avatar",
      replacedAt: null,
      status: "linked"
    });
    const { mediaRoutes } = await import("#@/routes/media");
    const response = await mediaRoutes.request("http://localhost/avatar/user/file.png");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("content-length")).toBe("3");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("returns 404 when a linked media file is missing", async () => {
    getMediaAssetByKey.mockResolvedValue({
      contentType: "image/png",
      purpose: "avatar",
      replacedAt: null,
      status: "linked"
    });
    const { mediaRoutes } = await import("#@/routes/media");
    expect((await mediaRoutes.request("http://localhost/avatar/user/missing.png")).status).toBe(
      404
    );
  });
});
