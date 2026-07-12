import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { Hono } from "hono";

import {
  getPendingMediaUploadRow,
  resolveMediaUploadMaxBytes,
  saveUploadedMediaObject,
  verifyUploadToken
} from "@saasweave/app/storage/media-asset";
import { canServePublicMediaAsset } from "@saasweave/core/media-asset";
import { normalizeMediaKey, resolveSafeMediaPath } from "@saasweave/core/media-asset";
import { readBoundedRequestOrNull } from "@saasweave/core/security";
import { getMediaAssetByKey } from "@saasweave/db";
import { ENV_SERVER } from "@saasweave/env/server/env";

export const mediaRoutes = new Hono();

mediaRoutes.put("/upload/:assetId", async (c) => {
  const assetId = c.req.param("assetId");
  const token = c.req.query("token");
  if (!token || !verifyUploadToken(assetId, token)) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const row = await getPendingMediaUploadRow(assetId);
  if (!row) {
    return c.json({ error: "upload_not_pending" }, 400);
  }

  const maxBytes = resolveMediaUploadMaxBytes(row);
  const body = await readBoundedRequestOrNull(c.req.raw, maxBytes);
  if (body === null) return c.json({ error: "payload_too_large" }, 413);

  const contentType = c.req.header("content-type") ?? "application/octet-stream";
  const saved = await saveUploadedMediaObject(assetId, body, contentType);
  if (!saved) return c.json({ error: "upload_failed" }, 400);
  return c.json({ ok: true });
});

mediaRoutes.get("/:key{.+}", async (c) => {
  const rawKey = c.req.param("key");
  if (rawKey.includes("..") || rawKey.includes("\\")) return c.notFound();

  const key = normalizeMediaKey(rawKey);
  if (!key) return c.notFound();

  const row = await getMediaAssetByKey(key);
  if (!row || !canServePublicMediaAsset(row)) return c.notFound();

  const absolutePath = resolveSafeMediaPath(ENV_SERVER.MEDIA_UPLOAD_DIR, key);
  if (!absolutePath) return c.notFound();

  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) return c.notFound();

    const stream = Readable.toWeb(createReadStream(absolutePath)) as BodyInit;
    return new Response(stream, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(fileStat.size),
        "Content-Type": row.contentType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return c.notFound();
  }
});
