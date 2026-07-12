export const MEDIA_ASSET_PURPOSES = ["avatar", "attachment", "private"] as const;
export const MEDIA_ASSET_STATUSES = ["pending", "uploaded", "linked", "orphan", "deleted"] as const;

/** Purposes that may be served from the public media handler when linked. */
export const PUBLIC_MEDIA_PURPOSES = ["avatar"] as const;

export const MAX_AVATAR_BYTES = 2_000_000;
export const MAX_MEDIA_BYTES = 8_000_000;
export const UPLOAD_TOKEN_TTL_SECONDS = 15 * 60;

export const AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Retain pending upload rows before cleanup deletes them. */
export const PENDING_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Retain uploaded-but-unlinked objects before cleanup deletes them. */
export const ORPHAN_UPLOAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Grace period before replaced avatar objects are purged. */
export const REPLACED_AVATAR_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Default chunk size for storage lifecycle cleanup jobs. */
export const MEDIA_CLEANUP_CHUNK_SIZE = 100;
