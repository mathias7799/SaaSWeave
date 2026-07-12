import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getPendingMediaUploadRow = vi.fn();
const resolveMediaUploadMaxBytes = vi.fn();
const saveUploadedMediaObject = vi.fn();
const verifyUploadToken = vi.fn();

vi.mock("@saasweave/app/storage/media-asset", () => {
  return {
    getPendingMediaUploadRow,
    resolveMediaUploadMaxBytes,
    saveUploadedMediaObject,
    verifyUploadToken
  };
});

vi.mock("@saasweave/db", () => {
  return {
    getMediaAssetByKey: vi.fn()
  };
});

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      MEDIA_UPLOAD_DIR: "/tmp/uploads"
    }
  };
});

function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[index]!);
      index += 1;
    }
  });
}

describe("media upload route", () => {
  beforeEach(() => {
    vi.resetModules();
    getPendingMediaUploadRow.mockReset();
    resolveMediaUploadMaxBytes.mockReset();
    saveUploadedMediaObject.mockReset();
    verifyUploadToken.mockReset();
  });

  it("returns 413 for chunked uploads above the row limit", async () => {
    verifyUploadToken.mockReturnValue(true);
    getPendingMediaUploadRow.mockResolvedValue({
      contentType: "image/png",
      id: "asset-1",
      key: "avatar/user/file.png",
      purpose: "avatar",
      size: 4,
      status: "pending"
    });
    resolveMediaUploadMaxBytes.mockReturnValue(4);

    const { mediaRoutes } = await import("#@/routes/media");
    const response = await mediaRoutes.request(
      new Request("http://localhost/upload/asset-1?token=ok", {
        body: streamFromChunks([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]),
        duplex: "half",
        headers: { "content-type": "image/png" },
        method: "PUT"
      } as RequestInit)
    );

    expect(response.status).toBe(413);
    expect(saveUploadedMediaObject).not.toHaveBeenCalled();
  });

  it("rejects missing tokens and uploads without pending rows", async () => {
    const { mediaRoutes } = await import("#@/routes/media");
    expect(
      (await mediaRoutes.request("http://localhost/upload/asset-1", { method: "PUT" })).status
    ).toBe(401);

    verifyUploadToken.mockReturnValue(true);
    getPendingMediaUploadRow.mockResolvedValue(null);
    expect(
      (await mediaRoutes.request("http://localhost/upload/asset-1?token=ok", { method: "PUT" }))
        .status
    ).toBe(400);
  });

  it.each([
    { saved: false, status: 400 },
    { saved: true, status: 200 }
  ])("returns $status when persistence result is $saved", async ({ saved, status }) => {
    verifyUploadToken.mockReturnValue(true);
    getPendingMediaUploadRow.mockResolvedValue({ id: "asset-1", status: "pending" });
    resolveMediaUploadMaxBytes.mockReturnValue(32);
    saveUploadedMediaObject.mockResolvedValue(saved);
    const { mediaRoutes } = await import("#@/routes/media");
    const response = await mediaRoutes.request(
      new Request("http://localhost/upload/asset-1?token=ok", {
        body: new Uint8Array([1, 2]),
        duplex: "half",
        method: "PUT"
      } as RequestInit)
    );
    expect(response.status).toBe(status);
    expect(saveUploadedMediaObject).toHaveBeenCalledWith(
      "asset-1",
      new Uint8Array([1, 2]),
      "application/octet-stream"
    );
  });

  it("returns 413 when Content-Length is absent but streamed bytes exceed the limit", async () => {
    verifyUploadToken.mockReturnValue(true);
    getPendingMediaUploadRow.mockResolvedValue({
      contentType: "image/png",
      id: "asset-1",
      key: "avatar/user/file.png",
      purpose: "avatar",
      size: 100,
      status: "pending"
    });
    resolveMediaUploadMaxBytes.mockReturnValue(2);

    const { mediaRoutes } = await import("#@/routes/media");
    const response = await mediaRoutes.request(
      new Request("http://localhost/upload/asset-1?token=ok", {
        body: streamFromChunks([new Uint8Array([1, 2, 3])]),
        duplex: "half",
        headers: { "content-type": "image/png" },
        method: "PUT"
      } as RequestInit)
    );

    expect(response.status).toBe(413);
  });
});
