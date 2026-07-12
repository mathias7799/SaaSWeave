import { eq } from "drizzle-orm";

import { db } from "#@/connection";
import { mediaAsset } from "#@/schema/media-asset.schema";

export type MediaAssetByKey = {
  contentType: string;
  purpose: string;
  replacedAt: Date | null;
  status: string;
};

export async function getMediaAssetByKey(key: string): Promise<MediaAssetByKey | null> {
  const rows = await db
    .select({
      contentType: mediaAsset.contentType,
      purpose: mediaAsset.purpose,
      replacedAt: mediaAsset.replacedAt,
      status: mediaAsset.status
    })
    .from(mediaAsset)
    .where(eq(mediaAsset.key, key))
    .limit(1);
  return rows[0] ?? null;
}
