import { randomUUID } from "node:crypto";
import { extname, resolve, sep } from "node:path";

import { PUBLIC_MEDIA_PURPOSES } from "#@/media-asset/constants";
import { type MediaAssetPurpose } from "#@/media-asset/types";

export function buildMediaAssetKey(input: {
  fileName: string;
  ownerId: string;
  purpose: MediaAssetPurpose;
}): string {
  const extension = extname(input.fileName).replace(/^\./, "").toLowerCase() || "bin";
  return `${input.purpose}/${input.ownerId}/${randomUUID()}.${extension}`;
}

export function resolveMediaPublicUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Reject traversal, absolute paths, and other unsafe storage keys. */
export function normalizeMediaKey(key: string): string | null {
  const normalized = key.replaceAll("\\", "/").replace(/^\/+/, "").trim();
  if (!normalized || normalized.includes("\0")) return null;

  const segments = normalized.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return null;
  }

  return normalized;
}

/** Resolve a storage key to an absolute path that must stay within uploadDir. */
export function resolveSafeMediaPath(uploadDir: string, key: string): string | null {
  const normalized = normalizeMediaKey(key);
  if (!normalized) return null;

  const root = resolve(uploadDir);
  const absolutePath = resolve(root, normalized);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    return null;
  }

  return absolutePath;
}

export function isPublicMediaPurpose(purpose: string): boolean {
  return PUBLIC_MEDIA_PURPOSES.includes(purpose as (typeof PUBLIC_MEDIA_PURPOSES)[number]);
}

export function canServePublicMediaAsset(row: {
  purpose: string;
  replacedAt: Date | null;
  status: string;
}): boolean {
  return row.status === "linked" && isPublicMediaPurpose(row.purpose) && row.replacedAt === null;
}
