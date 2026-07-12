/**
 * Resolve the client IP for rate limiting.
 *
 * When `trustProxyHeaders` is enabled (e.g. behind Coolify/nginx), forwarded headers are
 * consulted first (`x-forwarded-for`, then `x-real-ip`). Otherwise, `socketAddress` — the
 * direct TCP remote address supplied by the caller — is used as a fallback so each client
 * gets its own rate-limit bucket. Returns `"unknown"` only when no address can be resolved.
 */
export function resolveClientIp(
  headers: Headers,
  options: { trustProxyHeaders: boolean; socketAddress?: string | null | undefined }
): string {
  if (options.trustProxyHeaders) {
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const realIp = headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }

  const socketAddress = options.socketAddress?.trim();
  if (socketAddress) return socketAddress;

  return "unknown";
}
