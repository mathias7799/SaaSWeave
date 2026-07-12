import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import { copyFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";

import { normalizeMediaKey } from "@saasweave/core/media-asset";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { storageErrorsTotal } from "@saasweave/observability";

import { getFilesClient } from "#@/storage/files-client";

export type DataExportWriter = {
  bytesWritten: number;
  close: () => Promise<void>;
  path: string;
  writeLine: (value: unknown) => Promise<void>;
};

export async function createDataExportWriter(requestId: string): Promise<DataExportWriter> {
  const path = join(tmpdir(), `data-export-${requestId}-${randomUUID()}.ndjson`);
  await mkdir(dirname(path), { recursive: true });

  const stream: WriteStream = createWriteStream(path, { flags: "w" });
  let bytesWritten = 0;
  let pending = Promise.resolve();

  const writeChunk = (chunk: string): Promise<void> =>
    new Promise((resolve, reject) => {
      stream.write(chunk, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

  return {
    get bytesWritten() {
      return bytesWritten;
    },
    path,
    writeLine: async (value: unknown) => {
      const line = `${JSON.stringify(value)}\n`;
      bytesWritten += Buffer.byteLength(line, "utf8");
      pending = pending.then(() => writeChunk(line));
      await pending;
    },
    close: async () => {
      try {
        await pending;
      } finally {
        // Always end the stream so a prior write error can't leak the fd.
        await new Promise<void>((resolve, reject) => {
          stream.end(() => resolve());
          stream.on("error", reject);
        });
      }
    }
  };
}

export async function uploadDataExportFile(key: string, localPath: string): Promise<void> {
  const normalizedKey = normalizeMediaKey(key);
  if (!normalizedKey) {
    throw new Error("invalid_export_key");
  }

  const files = getFilesClient();
  if (files) {
    const body = Readable.toWeb(createReadStream(localPath)) as ReadableStream<Uint8Array>;
    try {
      await files.upload(normalizedKey, body, {
        contentType: "application/x-ndjson",
        multipart: true
      });
    } catch (error) {
      storageErrorsTotal.inc({ operation: "export_upload" });
      throw error;
    }
    return;
  }

  const absolutePath = join(ENV_SERVER.MEDIA_UPLOAD_DIR, normalizedKey);
  await mkdir(dirname(absolutePath), { recursive: true });
  try {
    await copyFile(localPath, absolutePath);
  } catch (error) {
    storageErrorsTotal.inc({ operation: "export_copy" });
    throw error;
  }
}

export async function cleanupDataExportWriter(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Best-effort temp cleanup.
  }
}

export function buildDataExportNdjsonKey(organizationId: string, requestId: string): string {
  return `exports/${organizationId}/${requestId}.ndjson`;
}
