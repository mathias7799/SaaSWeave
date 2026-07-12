import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  buildMediaAssetKey,
  canServePublicMediaAsset,
  isPublicMediaPurpose,
  mediaAssetPurposeSchema,
  normalizeMediaKey,
  resolveMediaPublicUrl,
  resolveSafeMediaPath
} from "@saasweave/core/media-asset";

describe("media asset keys", () => {
  it("builds owner-scoped keys with extensions", () => {
    const key = buildMediaAssetKey({
      fileName: "avatar.PNG",
      ownerId: "user_1",
      purpose: "avatar"
    });
    expect(key.startsWith("avatar/user_1/")).toBe(true);
    expect(key.endsWith(".png")).toBe(true);
  });

  it("keeps data exports outside the generic media-purpose contract", () => {
    expect(mediaAssetPurposeSchema.safeParse("export").success).toBe(false);
    expect(mediaAssetPurposeSchema.safeParse("private").success).toBe(true);
  });

  it("falls back to a bin extension when the filename has no extension", () => {
    expect(
      buildMediaAssetKey({ fileName: "avatar", ownerId: "user_1", purpose: "private" })
    ).toMatch(/^private\/user_1\/.+\.bin$/);
  });
});

describe("resolveMediaPublicUrl", () => {
  it("joins the base URL with encoded path segments", () => {
    expect(resolveMediaPublicUrl("https://cdn.example.com/", "avatar/user_1/photo name.png")).toBe(
      "https://cdn.example.com/avatar/user_1/photo%20name.png"
    );
  });

  it("strips a trailing slash from the base URL before joining", () => {
    expect(resolveMediaPublicUrl("https://cdn.example.com", "avatar/user_1/photo.png")).toBe(
      "https://cdn.example.com/avatar/user_1/photo.png"
    );
  });
});

describe("normalizeMediaKey", () => {
  it("rejects traversal segments", () => {
    expect(normalizeMediaKey("../secret.txt")).toBeNull();
    expect(normalizeMediaKey("avatar/../../etc/passwd")).toBeNull();
  });

  it("normalizes backslashes and leading slashes", () => {
    expect(normalizeMediaKey("\\avatar\\user\\file.png")).toBe("avatar/user/file.png");
    expect(normalizeMediaKey("/avatar/user/file.png")).toBe("avatar/user/file.png");
  });

  it.each(["", "   ", "avatar//file.png", "avatar/./file.png", "avatar/\0file.png"])(
    "rejects malformed key %j",
    (key) => {
      expect(normalizeMediaKey(key)).toBeNull();
    }
  );
});

describe("public media policy", () => {
  it("serves only linked, unreplaced avatars", () => {
    expect(isPublicMediaPurpose("avatar")).toBe(true);
    expect(isPublicMediaPurpose("private")).toBe(false);
    expect(
      canServePublicMediaAsset({ purpose: "avatar", replacedAt: null, status: "linked" })
    ).toBe(true);
    expect(
      canServePublicMediaAsset({ purpose: "private", replacedAt: null, status: "linked" })
    ).toBe(false);
    expect(
      canServePublicMediaAsset({ purpose: "avatar", replacedAt: new Date(), status: "linked" })
    ).toBe(false);
    expect(
      canServePublicMediaAsset({ purpose: "avatar", replacedAt: null, status: "orphan" })
    ).toBe(false);
  });
});

describe("resolveSafeMediaPath", () => {
  const uploadDir = join(tmpdir(), "media-safe-path-test");

  it("keeps resolved paths inside the upload root", () => {
    expect(resolveSafeMediaPath(uploadDir, "avatar/user/file.png")).toContain(
      "avatar/user/file.png"
    );
    expect(resolveSafeMediaPath(uploadDir, "../outside.txt")).toBeNull();
  });
});
