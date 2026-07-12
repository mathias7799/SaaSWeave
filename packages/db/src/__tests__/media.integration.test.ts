import { beforeEach, describe, expect, it } from "vite-plus/test";

import { getMediaAssetByKey } from "@saasweave/db";

import { resetDb, seedMediaAsset, seedOrgWithOwner } from "./db-harness";

describe.sequential("media", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns media assets by storage key", async () => {
    const seed = await seedOrgWithOwner();
    await seedMediaAsset({
      contentType: "image/png",
      key: "avatars/test.png",
      ownerId: seed.userId,
      status: "linked"
    });

    const found = await getMediaAssetByKey("avatars/test.png");
    expect(found).toEqual({
      contentType: "image/png",
      purpose: "avatar",
      replacedAt: null,
      status: "linked"
    });

    const missing = await getMediaAssetByKey("avatars/missing.png");
    expect(missing).toBeNull();
  });
});
