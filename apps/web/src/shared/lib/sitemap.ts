const PRIVATE_ROUTE_PREFIXES = [
  "/app",
  "/admin",
  "/sign-in",
  "/create-an-account",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/dashboard",
  "/accept-invite"
] as const;

export function shouldIncludePathInSitemap(path: string): boolean {
  const normalized = path.toLowerCase();

  if (PRIVATE_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }

  if (normalized.includes("/_api/") || normalized.endsWith("/_api")) {
    return false;
  }

  if (normalized.includes(".")) {
    return false;
  }

  if (normalized.includes("$") || normalized.includes(":")) {
    return false;
  }

  if (normalized.includes("_")) {
    return false;
  }

  return true;
}

export { PRIVATE_ROUTE_PREFIXES };
