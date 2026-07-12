import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  return {
    getFilesClient: vi.fn(),
    storageError: vi.fn()
  };
});

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: { MEDIA_UPLOAD_DIR: join(tmpdir(), "saasweave-export-writer") }
  };
});
vi.mock("@saasweave/observability", () => {
  return {
    storageErrorsTotal: { inc: mocks.storageError }
  };
});
vi.mock("#@/storage/files-client", () => {
  return { getFilesClient: mocks.getFilesClient };
});

import {
  buildDataExportNdjsonKey,
  cleanupDataExportWriter,
  createDataExportWriter,
  uploadDataExportFile
} from "#@/data-export/stream-writer";

describe("data export writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFilesClient.mockReturnValue(null);
  });

  it("writes ordered NDJSON lines and tracks UTF-8 bytes", async () => {
    const writer = await createDataExportWriter("request-1");
    await writer.writeLine({ value: "one" });
    await writer.writeLine({ value: "€" });
    await writer.close();

    const content = await readFile(writer.path, "utf8");
    expect(content).toBe('{"value":"one"}\n{"value":"€"}\n');
    expect(writer.bytesWritten).toBe(Buffer.byteLength(content));
    await cleanupDataExportWriter(writer.path);
    await expect(readFile(writer.path)).rejects.toThrow(/ENOENT/);
    await expect(cleanupDataExportWriter(writer.path)).resolves.toBeUndefined();
  });

  it("copies valid exports to local storage and rejects traversal keys", async () => {
    const directory = await mkdtemp(join(tmpdir(), "writer-source-"));
    const source = join(directory, "source.ndjson");
    await writeFile(source, "{}\n");

    await uploadDataExportFile("exports/org-1/request.ndjson", source);
    await expect(
      readFile(join(tmpdir(), "saasweave-export-writer/exports/org-1/request.ndjson"), "utf8")
    ).resolves.toBe("{}\n");
    await expect(uploadDataExportFile("../escape.ndjson", source)).rejects.toThrow(
      "invalid_export_key"
    );
  });

  it("uploads through object storage and records upload failures", async () => {
    const upload = vi.fn(async () => undefined);
    mocks.getFilesClient.mockReturnValue({ upload });
    const directory = await mkdtemp(join(tmpdir(), "writer-object-"));
    const source = join(directory, "source.ndjson");
    await writeFile(source, "{}\n");

    await uploadDataExportFile("exports/org-1/request.ndjson", source);
    expect(upload).toHaveBeenCalledWith(
      "exports/org-1/request.ndjson",
      expect.any(ReadableStream),
      { contentType: "application/x-ndjson", multipart: true }
    );

    upload.mockRejectedValueOnce(new Error("upload failed"));
    await expect(uploadDataExportFile("exports/org-1/request.ndjson", source)).rejects.toThrow(
      "upload failed"
    );
    expect(mocks.storageError).toHaveBeenCalledWith({ operation: "export_upload" });
    expect(buildDataExportNdjsonKey("org-1", "request-1")).toBe("exports/org-1/request-1.ndjson");
  });
});
