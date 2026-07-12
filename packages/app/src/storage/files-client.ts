import { Files } from "files-sdk";
import { minio } from "files-sdk/minio";

import { ENV_SERVER } from "@saasweave/env/server/env";

export type MinioEnv = {
  MINIO_ENDPOINT: string;
  MINIO_BUCKET: string;
  MINIO_ACCESS_KEY_ID: string;
  MINIO_SECRET_ACCESS_KEY: string;
};

export function hasCompleteMinioConfig(config: MinioEnv): boolean {
  return Boolean(
    config.MINIO_ENDPOINT &&
    config.MINIO_BUCKET &&
    config.MINIO_ACCESS_KEY_ID &&
    config.MINIO_SECRET_ACCESS_KEY
  );
}

let filesClient: Files | null | undefined;
let privateFilesClient: Files | null | undefined;

export function isObjectStorageEnabled(): boolean {
  return hasCompleteMinioConfig(ENV_SERVER);
}

/** Configured files-sdk client when MinIO/S3 env vars are set. */
export function getFilesClient(): Files | null {
  if (filesClient !== undefined) return filesClient;
  if (!isObjectStorageEnabled()) {
    filesClient = null;
    return filesClient;
  }

  filesClient = new Files({
    adapter: minio({
      accessKeyId: ENV_SERVER.MINIO_ACCESS_KEY_ID,
      bucket: ENV_SERVER.MINIO_BUCKET,
      endpoint: ENV_SERVER.MINIO_ENDPOINT,
      publicBaseUrl: ENV_SERVER.MINIO_PUBLIC_BASE_URL,
      secretAccessKey: ENV_SERVER.MINIO_SECRET_ACCESS_KEY
    }),
    prefix: "uploads"
  });
  return filesClient;
}

/** Object-storage client that always signs reads, including for otherwise public buckets. */
export function getPrivateFilesClient(): Files | null {
  if (privateFilesClient !== undefined) return privateFilesClient;
  if (!isObjectStorageEnabled()) {
    privateFilesClient = null;
    return privateFilesClient;
  }

  privateFilesClient = new Files({
    adapter: minio({
      accessKeyId: ENV_SERVER.MINIO_ACCESS_KEY_ID,
      bucket: ENV_SERVER.MINIO_BUCKET,
      endpoint: ENV_SERVER.MINIO_ENDPOINT,
      secretAccessKey: ENV_SERVER.MINIO_SECRET_ACCESS_KEY
    }),
    prefix: "uploads"
  });
  return privateFilesClient;
}

export async function resolveStoredObjectUrl(key: string): Promise<string> {
  const files = getFilesClient();
  if (files) return files.url(key);
  return `${ENV_SERVER.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}
