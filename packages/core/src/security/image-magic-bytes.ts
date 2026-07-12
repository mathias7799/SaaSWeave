const JPEG_PREFIX = [0xff, 0xd8, 0xff] as const;
const PNG_PREFIX = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const RIFF_PREFIX = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const;

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.byteLength < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  if (!startsWith(bytes, RIFF_PREFIX)) return false;
  return WEBP_SIGNATURE.every((value, index) => bytes[8 + index] === value);
}

/**
 * Validate image magic bytes for avatar MIME types (JPEG, PNG, WebP).
 */
export function validateImageMagicBytes(contentType: string, bytes: Uint8Array): boolean {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  switch (normalized) {
    case "image/jpeg":
    case "image/jpg":
      return startsWith(bytes, JPEG_PREFIX);
    case "image/png":
      return startsWith(bytes, PNG_PREFIX);
    case "image/webp":
      return hasWebpSignature(bytes);
    default:
      return false;
  }
}
