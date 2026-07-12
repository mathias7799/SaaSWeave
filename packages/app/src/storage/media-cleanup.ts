import { stat, unlink } from "node:fs/promises";

import { inArray } from "drizzle-orm";

import { resolveSafeMediaPath } from "@saasweave/core/media-asset";
import {
  db,
  deleteDataExportRequest,
  deleteMediaAssetRow,
  listExpiredOrphanUploadAssetIds,
  listExpiredPendingUploadAssetIds,
  listExpiredReadyExportIds,
  listReplacedAvatarAssetIds,
  listStaleFailedExportIds,
  recordAudit,
  type DataExportCleanupResult,
  type MediaLifecycleCleanupResult
} from "@saasweave/db";
import { mediaAsset } from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { createLogger } from "@saasweave/logger/server";

import { getFilesClient, isObjectStorageEnabled } from "#@/storage/files-client";
import { deleteMediaAssetObject } from "#@/storage/media-asset/index";

const log = createLogger({ operation: "app__storage_cleanup" });

async function deleteStorageObject(key: string): Promise<void> {
  const files = getFilesClient();
  if (files) {
    await files.delete(key).catch(() => undefined);
    return;
  }

  const absolutePath = resolveSafeMediaPath(ENV_SERVER.MEDIA_UPLOAD_DIR, key);
  if (!absolutePath) return;
  await unlink(absolutePath).catch(() => undefined);
}

export async function deleteDataExportObject(fileKey: string): Promise<void> {
  const files = getFilesClient();
  if (files) {
    await files.delete(fileKey);
    return;
  }

  const absolutePath = resolveSafeMediaPath(ENV_SERVER.MEDIA_UPLOAD_DIR, fileKey);
  if (!absolutePath) throw new Error("invalid_export_storage_key");
  await unlink(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

async function cleanupLocalRowsMissingObjects(): Promise<number> {
  const rows = await db
    .select({ id: mediaAsset.id, key: mediaAsset.key })
    .from(mediaAsset)
    .where(inArray(mediaAsset.status, ["orphan", "linked"]))
    .limit(100);

  let removed = 0;
  for (const row of rows) {
    const absolutePath = resolveSafeMediaPath(ENV_SERVER.MEDIA_UPLOAD_DIR, row.key);
    if (!absolutePath) continue;
    const exists = await stat(absolutePath)
      .then((entry) => entry.isFile())
      .catch(() => false);
    if (!exists) {
      await deleteMediaAssetRow(row.id);
      removed += 1;
    }
  }

  return removed;
}

export async function runMediaLifecycleCleanup(): Promise<MediaLifecycleCleanupResult> {
  const result: MediaLifecycleCleanupResult = {
    expiredPendingUploads: 0,
    missingObjectRows: 0,
    orphanedUploads: 0,
    replacedAvatars: 0
  };

  for (const assetId of await listExpiredPendingUploadAssetIds()) {
    await deleteMediaAssetRow(assetId);
    result.expiredPendingUploads += 1;
  }

  for (const row of await listExpiredOrphanUploadAssetIds()) {
    await deleteStorageObject(row.key);
    await deleteMediaAssetRow(row.id);
    result.orphanedUploads += 1;
  }

  for (const row of await listReplacedAvatarAssetIds()) {
    await deleteMediaAssetObject(row.id, row.ownerId);
    result.replacedAvatars += 1;
  }

  if (!isObjectStorageEnabled()) {
    result.missingObjectRows = await cleanupLocalRowsMissingObjects();
  }

  if (
    result.expiredPendingUploads > 0 ||
    result.orphanedUploads > 0 ||
    result.replacedAvatars > 0 ||
    result.missingObjectRows > 0
  ) {
    await recordAudit({
      action: "media.cleanup.completed",
      metadata: result,
      targetType: "media_asset"
    });
  }

  log.info("Media lifecycle cleanup completed", {
    event: "media_cleanup_completed",
    ...result
  });

  return result;
}

export async function runDataExportCleanup(): Promise<DataExportCleanupResult> {
  const result: DataExportCleanupResult = {
    expiredExports: 0,
    failedExports: 0
  };

  for (const row of await listExpiredReadyExportIds()) {
    if (row.fileKey) await deleteDataExportObject(row.fileKey);
    await deleteDataExportRequest(row.id);
    result.expiredExports += 1;
  }

  for (const id of await listStaleFailedExportIds()) {
    await deleteDataExportRequest(id);
    result.failedExports += 1;
  }

  if (result.expiredExports > 0 || result.failedExports > 0) {
    await recordAudit({
      action: "data_export.cleanup.completed",
      metadata: result,
      targetType: "data_export_request"
    });
  }

  log.info("Data export cleanup completed", {
    event: "data_export_cleanup_completed",
    ...result
  });

  return result;
}
