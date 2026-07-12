# Media Storage And Uploads

Use this when introducing or changing S3-compatible object storage, upload contracts, object-delete behavior, or the database record that tracks uploaded files.

This repo ships local-disk media storage for development and small deployments.

## Current Implementation

- **Provider**: local filesystem via `MEDIA_UPLOAD_DIR` (default `.uploads`), or MinIO/S3 via `files-sdk` when `MINIO_*` env vars are set
- **Public URLs**: `MEDIA_PUBLIC_BASE_URL` (default `http://localhost:5000/server/media`) for **linked avatars only**
- **Private downloads**: workspace data exports use authenticated `/exports/:id/download` (local stream or short-lived signed GET for object storage); attachment/export/private purposes are never served from the public media handler
- **Packages**: shared limits/contracts in `packages/core`, rows and lifecycle queries in `packages/db`, storage/export services in `packages/app`, authenticated download authorization in `packages/api`, and HTTP streaming in `apps/server`
- **Upload flow**: signed PUT to `apps/server` `/media/upload/:assetId`, then `completeAvatarUpload` links the asset
- **Delete policy**: synchronized hard delete for explicit removals; replaced avatars are marked `replacedAt` and purged by the storage cleanup schedule after the new link succeeds
- **Cleanup**: BullMQ schedule job `cleanup-storage` (`WORKER_SCHEDULE_STORAGE_CLEANUP_CRON`, default `30 4 * * *`) purges expired pending uploads, uploaded orphans, replaced avatars, expired export files, stale failed exports, and local DB/object mismatches

This file is prescriptive for extensions and should stay aligned with the running code.

This guide should stay aligned with:

- [Core package patterns](./core.md)
- [Environment variables](./environment-variables.md)
- [oRPC patterns](./orpc.md)
- [Workflow](./workflow.md)

## Goals

- Treat `media_asset` as a generic object-storage record. Current purposes are `avatar`, `attachment`, `export`, and `private`; add a purpose to the shared contract instead of creating feature-specific storage metadata.
- Keep object-storage metadata generic: owner, purpose, key, content type, size, lifecycle timestamps (`uploadedAt`, `linkedAt`, `replacedAt`), and status. Derive delivery URLs from config and `key` instead of persisting them on the row.
- Keep business metadata on the owning row, not on `media_asset`. Alt text, captions, labels, and document titles belong to the domain record that links to the object.
- Default to direct browser-to-storage uploads, with the API brokering signed contracts and lifecycle state.
- Default to synchronized hard delete because it is the simplest lifecycle that does not require a sweeper or retry worker. Background cleanup covers abandoned uploads, replaced avatars, and expired exports.
- Keep soft-delete capability available for future exceptions, but do not build around it by default.

## Delivery Policy

| Asset class                | Public handler                                             | Download path                                                                                      |
| -------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Linked avatar              | Yes (`status=linked`, `purpose=avatar`, `replacedAt=null`) | Public media URL                                                                                   |
| Pending / orphaned upload  | No                                                         | Not downloadable                                                                                   |
| Attachment / private asset | No                                                         | Authenticated or signed download when product flows add them                                       |
| Workspace data export      | No                                                         | Session-authenticated `/exports/:id/download` or signed GET URL from `console.dataExport.download` |

Public media route rules:

- Normalize keys with `normalizeMediaKey()` and resolve files with `resolveSafeMediaPath()` so corrupted DB keys cannot escape `MEDIA_UPLOAD_DIR`.
- Never serve `pending`, `uploaded`, `orphan`, `deleted`, non-avatar purposes, or rows with `replacedAt` set. Public delivery requires `status=linked`, `purpose=avatar`, and `replacedAt=null`.

Data export rules:

- Only workspace owners/admins may download.
- Export must be `ready`, unexpired (`expiresAt`), and not revoked (`downloadRevokedAt`).
- Local storage streams with `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and `MAX_DATA_EXPORT_DOWNLOAD_BYTES`.
- Object storage uses `getPrivateFilesClient()` and a short-lived signed GET. Never resolve exports through the public client or `MINIO_PUBLIC_BASE_URL`; `files-sdk` skips signing when `publicBaseUrl` is configured.
- Export generation is streaming NDJSON and bounded by shared row/byte limits. A retry starts a new temporary artifact and restarts the export from the beginning; progress counters are operational only, not resumable checkpoints.

## Recommended Library

Use `files-sdk` for object storage access and signed uploads.

Default choice for this template:

- `files-sdk`
- `files-sdk/minio` for MinIO or other S3-compatible endpoints

When the repo uses `files-sdk`, prefer adapter-provided URL resolution such as `await files.url(key)` over hand-rolled public URL helpers. For exports and private assets, always pass `expiresIn` so `url()` returns a presigned GET.

## Default Package Shape

```text
packages/core/src/media-asset/
packages/core/src/data-export/
packages/db/src/schema/media-asset.schema.ts
packages/db/src/schema/data-export-request.schema.ts
packages/db/src/media-lifecycle.ts
packages/app/src/storage/media-asset/index.ts
packages/app/src/storage/media-cleanup.ts
packages/app/src/data-export/{process,storage,stream-export,stream-writer}.ts
packages/api/src/lib/data-export/download.ts
apps/server/src/routes/media.ts
apps/server/src/routes/data-export.ts
```

## Upload Completion (Object Storage)

`completeMediaAssetUpload()` confirms the object with `files.head(key)` and validates actual `size` and `contentType` against the pending row before promoting state. Client-declared metadata alone is not trusted.

## Avatar Replacement

`completeAvatarUpload` links the new asset, updates `user.image`, then marks prior linked avatar rows with `replacedAt`. The old object is deleted only after the new link succeeds, via the storage cleanup job (or explicit delete helpers).

## Environment Variables

Storage-related server env names:

- `MEDIA_UPLOAD_DIR`
- `MEDIA_PUBLIC_BASE_URL`
- `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY_ID`, `MINIO_SECRET_ACCESS_KEY`
- `MINIO_PUBLIC_BASE_URL` (optional; used only for public avatar URL resolution, not exports)
- `WORKER_SCHEDULE_STORAGE_CLEANUP_CRON`

For env propagation and the exact update checklist, follow [Environment variables](./environment-variables.md).

## Permission And Policy Checklist

- Public-read and signed-read strategies stay separate.
- Workspace exports never route through `/media/*`.
- Browser upload CORS and size/content-type validation remain enforced in application code.
- Cleanup jobs are idempotent, chunked (`MEDIA_CLEANUP_CHUNK_SIZE`), and emit audit events without file keys in metadata.
