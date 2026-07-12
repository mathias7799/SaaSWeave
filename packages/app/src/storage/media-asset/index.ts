import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { and, eq } from "drizzle-orm";

import {
  AVATAR_CONTENT_TYPES,
  MAX_AVATAR_BYTES,
  MAX_MEDIA_BYTES,
  UPLOAD_TOKEN_TTL_SECONDS,
  type MediaAssetPurpose
} from "@saasweave/core/media-asset";
import { buildMediaAssetKey, resolveSafeMediaPath } from "@saasweave/core/media-asset";
import { validateImageMagicBytes } from "@saasweave/core/security";
import { db, markOtherLinkedAvatarsReplaced } from "@saasweave/db";
import { mediaAsset } from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";

import {
  getFilesClient,
  isObjectStorageEnabled,
  resolveStoredObjectUrl
} from "#@/storage/files-client";

function uploadRoot(): string {
  return ENV_SERVER.MEDIA_UPLOAD_DIR;
}

function signUploadToken(assetId: string, expiresAt: number): string {
  const payload = `${assetId}.${expiresAt}`;
  const signature = createHmac("sha256", ENV_SERVER.BETTER_AUTH_SECRET)
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyUploadToken(assetId: string, token: string): boolean {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const [tokenAssetId, expiresAtRaw] = payload.split(".");
  if (tokenAssetId !== assetId) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = createHmac("sha256", ENV_SERVER.BETTER_AUTH_SECRET)
    .update(payload)
    .digest("base64url");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function buildLocalUploadContract(assetId: string): { method: "PUT"; url: string } {
  const expiresAt = Date.now() + UPLOAD_TOKEN_TTL_SECONDS * 1_000;
  const token = signUploadToken(assetId, expiresAt);
  const base = new URL(ENV_SERVER.VITE_SERVER_URL);
  return {
    method: "PUT",
    url: `${base.origin}${base.pathname.replace(/\/$/, "")}/media/upload/${assetId}?token=${token}`
  };
}

export async function createMediaAssetUpload(input: {
  contentType: string;
  fileName: string;
  ownerId: string;
  purpose: MediaAssetPurpose;
  size: number;
}) {
  const id = randomUUID();
  const key = buildMediaAssetKey(input);
  await db.insert(mediaAsset).values({
    contentType: input.contentType,
    createdAt: new Date(),
    id,
    key,
    ownerId: input.ownerId,
    purpose: input.purpose,
    size: input.size,
    status: "pending"
  });

  const files = getFilesClient();
  if (files) {
    const contract = await files.signedUploadUrl(key, {
      contentType: input.contentType,
      expiresIn: UPLOAD_TOKEN_TTL_SECONDS,
      maxSize: input.size
    });
    return {
      contract,
      contentType: input.contentType,
      key,
      maxSize: input.size,
      mediaAssetId: id,
      purpose: input.purpose
    };
  }

  return {
    contract: buildLocalUploadContract(id),
    contentType: input.contentType,
    key,
    maxSize: input.size,
    mediaAssetId: id,
    purpose: input.purpose
  };
}

export type PendingMediaUploadRow = {
  contentType: string;
  id: string;
  key: string;
  purpose: MediaAssetPurpose;
  size: number;
  status: "pending";
};

export async function getPendingMediaUploadRow(
  assetId: string
): Promise<PendingMediaUploadRow | null> {
  const rows = await db.select().from(mediaAsset).where(eq(mediaAsset.id, assetId)).limit(1);
  const row = rows[0];
  if (!row || row.status !== "pending") return null;
  return {
    contentType: row.contentType,
    id: row.id,
    key: row.key,
    purpose: row.purpose as MediaAssetPurpose,
    size: row.size,
    status: row.status
  };
}

export function resolveMediaUploadMaxBytes(row: Pick<PendingMediaUploadRow, "purpose" | "size">) {
  const serverMax = row.purpose === "avatar" ? MAX_AVATAR_BYTES : MAX_MEDIA_BYTES;
  return Math.min(serverMax, row.size);
}

function normalizeContentType(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

async function removePartialFile(path: string) {
  await unlink(path).catch(() => undefined);
}

export async function saveUploadedMediaObject(
  assetId: string,
  body: Uint8Array,
  contentType: string
): Promise<boolean> {
  if (isObjectStorageEnabled()) return false;

  const row = await getPendingMediaUploadRow(assetId);
  if (!row) return false;

  const maxBytes = resolveMediaUploadMaxBytes(row);
  if (body.byteLength > maxBytes) return false;
  if (normalizeContentType(contentType) !== normalizeContentType(row.contentType)) return false;

  if (row.purpose === "avatar" && !validateImageMagicBytes(row.contentType, body)) {
    return false;
  }

  const absolutePath = resolveSafeMediaPath(uploadRoot(), row.key);
  if (!absolutePath) return false;
  const partialPath = `${absolutePath}.partial.${randomUUID()}`;
  await mkdir(dirname(absolutePath), { recursive: true });

  try {
    await writeFile(partialPath, body);
    await rename(partialPath, absolutePath);
  } catch {
    await removePartialFile(partialPath);
    return false;
  }

  await db
    .update(mediaAsset)
    .set({
      contentType: row.contentType,
      status: "orphan",
      uploadedAt: new Date()
    })
    .where(eq(mediaAsset.id, assetId));
  return true;
}

export async function completeMediaAssetUpload(input: {
  assetId: string;
  ownerId: string;
}): Promise<{ key: string; url: string } | null> {
  const rows = await db
    .select()
    .from(mediaAsset)
    .where(and(eq(mediaAsset.id, input.assetId), eq(mediaAsset.ownerId, input.ownerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const files = getFilesClient();
  if (files) {
    const exists = await files.exists(row.key);
    if (!exists) return null;

    const head = await files.head(row.key).catch(() => null);
    if (!head) return null;

    const actualType = normalizeContentType(head.type ?? "");
    const expectedType = normalizeContentType(row.contentType);
    if (!actualType || actualType !== expectedType) return null;

    const maxBytes = resolveMediaUploadMaxBytes({
      purpose: row.purpose as MediaAssetPurpose,
      size: row.size
    });
    if (head.size > maxBytes) return null;

    // Object storage never sees the bytes at upload time (client PUTs directly to
    // S3), so enforce the same avatar magic-byte check the local path applies.
    if (row.purpose === "avatar") {
      const sample = await files
        .download(row.key, { range: { end: 15, start: 0 } })
        .then((file) => file.arrayBuffer())
        .catch(() => null);
      if (!sample || !validateImageMagicBytes(row.contentType, new Uint8Array(sample))) {
        return null;
      }
    }

    if (row.status === "pending") {
      await db
        .update(mediaAsset)
        .set({
          size: head.size,
          status: "orphan",
          uploadedAt: new Date()
        })
        .where(eq(mediaAsset.id, input.assetId));
    }
  } else if (row.status === "pending") {
    return null;
  }

  await db
    .update(mediaAsset)
    .set({ linkedAt: new Date(), status: "linked" })
    .where(eq(mediaAsset.id, input.assetId));

  return {
    key: row.key,
    url: await resolveStoredObjectUrl(row.key)
  };
}

export async function deleteMediaAssetObject(assetId: string, ownerId: string): Promise<void> {
  const rows = await db
    .select()
    .from(mediaAsset)
    .where(and(eq(mediaAsset.id, assetId), eq(mediaAsset.ownerId, ownerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const files = getFilesClient();
  if (files) {
    await files.delete(row.key).catch(() => undefined);
  } else {
    const absolutePath = resolveSafeMediaPath(uploadRoot(), row.key);
    if (absolutePath) {
      await unlink(absolutePath).catch(() => undefined);
    }
  }
  await db.delete(mediaAsset).where(eq(mediaAsset.id, assetId));
}

export function assertAvatarUpload(input: { contentType: string; size: number }) {
  if (!AVATAR_CONTENT_TYPES.includes(input.contentType as (typeof AVATAR_CONTENT_TYPES)[number])) {
    throw new Error("Avatar must be a JPEG, PNG, or WebP image.");
  }
  if (input.size > MAX_AVATAR_BYTES) {
    throw new Error("Avatar must be 2 MB or smaller.");
  }
}

export async function finalizeAvatarReplacement(
  ownerId: string,
  newAssetId: string
): Promise<void> {
  await markOtherLinkedAvatarsReplaced(ownerId, newAssetId);
}
