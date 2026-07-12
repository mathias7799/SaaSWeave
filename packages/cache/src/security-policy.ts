import { ENV_SERVER } from "@saasweave/env/server/env";

import { type RateLimitFailureMode } from "#@/rate-limit";

export type SecurityFailureMode = RateLimitFailureMode;

/** Shared fail-closed policy for security-sensitive cache and rate-limit paths. */
export function resolveSecurityFailureMode(): SecurityFailureMode {
  if (
    ENV_SERVER.NODE_ENV === "production" &&
    ENV_SERVER.REDIS_URL &&
    !ENV_SERVER.ALLOW_SINGLE_INSTANCE_FALLBACK
  ) {
    return "failClosed";
  }

  return "failOpen";
}
