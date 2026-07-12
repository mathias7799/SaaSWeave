/** Known placeholder secrets that must not be used in production. */
export const WEAK_AUTH_SECRET_MARKERS = [
  "replace-with-at-least-32-characters",
  "replace_me_run_pnpm_auth_secret",
  "changeme",
  "replace-with-at-least-32-characters-generated-locally"
] as const;

export function isWeakAuthSecret(secret: string): boolean {
  const normalized = secret.trim().toLowerCase();
  if (normalized.length < 32) return true;
  return WEAK_AUTH_SECRET_MARKERS.some((marker) => normalized.includes(marker));
}
