import { and, eq, isNotNull, lt, ne } from "drizzle-orm";

import {
  MEDIA_CLEANUP_CHUNK_SIZE,
  ORPHAN_UPLOAD_RETENTION_MS,
  PENDING_UPLOAD_RETENTION_MS,
  REPLACED_AVATAR_RETENTION_MS
} from "@saasweave/core/media-asset";

import { db } from "#@/connection";
import { dataExportRequest } from "#@/schema/data-export-request.schema";
import { mediaAsset } from "#@/schema/media-asset.schema";

export type MediaLifecycleCleanupResult = {
  expiredPendingUploads: number;
  orphanedUploads: number;
  replacedAvatars: number;
  missingObjectRows: number;
};

export type DataExportCleanupResult = {
  expiredExports: number;
  failedExports: number;
};

export async function listExpiredPendingUploadAssetIds(
  limit = MEDIA_CLEANUP_CHUNK_SIZE
): Promise<string[]> {
  const cutoff = new Date(Date.now() - PENDING_UPLOAD_RETENTION_MS);
  const rows = await db
    .select({ id: mediaAsset.id })
    .from(mediaAsset)
    .where(and(eq(mediaAsset.status, "pending"), lt(mediaAsset.createdAt, cutoff)))
    .limit(limit);
  return rows.map((row) => row.id);
}

export async function listExpiredOrphanUploadAssetIds(
  limit = MEDIA_CLEANUP_CHUNK_SIZE
): Promise<Array<{ id: string; key: string; ownerId: string }>> {
  const cutoff = new Date(Date.now() - ORPHAN_UPLOAD_RETENTION_MS);
  const rows = await db
    .select({ id: mediaAsset.id, key: mediaAsset.key, ownerId: mediaAsset.ownerId })
    .from(mediaAsset)
    .where(
      and(
        eq(mediaAsset.status, "orphan"),
        isNotNull(mediaAsset.uploadedAt),
        lt(mediaAsset.uploadedAt, cutoff)
      )
    )
    .limit(limit);
  return rows;
}

export async function listReplacedAvatarAssetIds(
  limit = MEDIA_CLEANUP_CHUNK_SIZE
): Promise<Array<{ id: string; key: string; ownerId: string }>> {
  const cutoff = new Date(Date.now() - REPLACED_AVATAR_RETENTION_MS);
  const rows = await db
    .select({ id: mediaAsset.id, key: mediaAsset.key, ownerId: mediaAsset.ownerId })
    .from(mediaAsset)
    .where(and(isNotNull(mediaAsset.replacedAt), lt(mediaAsset.replacedAt, cutoff)))
    .limit(limit);
  return rows;
}

export async function deleteMediaAssetRow(assetId: string): Promise<void> {
  await db.delete(mediaAsset).where(eq(mediaAsset.id, assetId));
}

export async function listExpiredReadyExportIds(
  limit = MEDIA_CLEANUP_CHUNK_SIZE
): Promise<Array<{ fileKey: string | null; id: string }>> {
  const now = new Date();
  const rows = await db
    .select({ fileKey: dataExportRequest.fileKey, id: dataExportRequest.id })
    .from(dataExportRequest)
    .where(and(eq(dataExportRequest.status, "ready"), lt(dataExportRequest.expiresAt, now)))
    .limit(limit);
  return rows;
}

export async function listStaleFailedExportIds(
  limit = MEDIA_CLEANUP_CHUNK_SIZE
): Promise<string[]> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: dataExportRequest.id })
    .from(dataExportRequest)
    .where(and(eq(dataExportRequest.status, "failed"), lt(dataExportRequest.completedAt, cutoff)))
    .limit(limit);
  return rows.map((row) => row.id);
}

export async function deleteDataExportRequest(id: string): Promise<void> {
  await db.delete(dataExportRequest).where(eq(dataExportRequest.id, id));
}

export async function markOtherLinkedAvatarsReplaced(
  ownerId: string,
  keepAssetId: string
): Promise<number> {
  const rows = await db
    .update(mediaAsset)
    .set({ replacedAt: new Date() })
    .where(
      and(
        eq(mediaAsset.ownerId, ownerId),
        eq(mediaAsset.purpose, "avatar"),
        eq(mediaAsset.status, "linked"),
        ne(mediaAsset.id, keepAssetId)
      )
    )
    .returning({ id: mediaAsset.id });
  return rows.length;
}
