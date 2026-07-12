import { describe, expect, it } from "vite-plus/test";

import { validateImageMagicBytes } from "#@/security/image-magic-bytes";

describe("validateImageMagicBytes", () => {
  it("accepts valid JPEG, PNG, and WebP prefixes", () => {
    expect(validateImageMagicBytes("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(
      true
    );
    expect(
      validateImageMagicBytes(
        "image/png",
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe(true);
    expect(
      validateImageMagicBytes(
        "image/webp",
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
      )
    ).toBe(true);
  });

  it("rejects invalid image content", () => {
    expect(validateImageMagicBytes("image/png", new Uint8Array([0x00, 0x01]))).toBe(false);
    expect(validateImageMagicBytes("image/jpeg", new Uint8Array([0x89, 0x50]))).toBe(false);
  });
});
