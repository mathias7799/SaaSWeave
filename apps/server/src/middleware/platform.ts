import { getConnInfo } from "@hono/node-server/conninfo";
import { type MiddlewareHandler } from "hono";

import { checkRateLimit, resolveClientIp, resolveSecurityFailureMode } from "@saasweave/cache";
import { getPlatformSettings } from "@saasweave/db";
import { ENV_SERVER } from "@saasweave/env/server/env";

function rateLimitResponse(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({
      message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds)
      },
      status: 429
    }
  );
}

/** Rate-limit sensitive auth endpoints by client IP. */
export const authRateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  const ip = resolveClientIp(c.req.raw.headers, {
    trustProxyHeaders: ENV_SERVER.TRUST_PROXY_HEADERS,
    socketAddress: getConnInfo(c).remote.address
  });
  const limits: Array<{ match: RegExp; key: string; limit: number; windowSeconds: number }> = [
    { key: `auth:signup:${ip}`, limit: 5, match: /\/sign-up\/email$/, windowSeconds: 3_600 },
    {
      key: `auth:reset:${ip}`,
      limit: 10,
      match: /\/request-password-reset$/,
      windowSeconds: 3_600
    },
    { key: `auth:signin:${ip}`, limit: 30, match: /\/sign-in\/email$/, windowSeconds: 900 },
    { key: `auth:magic:${ip}`, limit: 10, match: /\/sign-in\/magic-link$/, windowSeconds: 3_600 }
  ];

  for (const rule of limits) {
    if (!rule.match.test(path)) continue;
    const result = await checkRateLimit(rule.key, rule.limit, rule.windowSeconds, {
      failureMode: resolveSecurityFailureMode()
    });
    if (!result.allowed) return rateLimitResponse(result.retryAfterSeconds);
  }

  await next();
};

const MUTATION_PREFIXES = ["/rpc", "/docs"];

/** Block non-GET API mutations while maintenance mode is on (health + auth exempt). */
export const maintenanceModeMiddleware: MiddlewareHandler = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (
    c.req.method === "GET" ||
    path.includes("/health/") ||
    path.includes("/auth/") ||
    path.includes("/stripe/webhook")
  ) {
    await next();
    return;
  }

  const settings = await getPlatformSettings();
  if (!settings.maintenanceMode) {
    await next();
    return;
  }

  const isApiMutation = MUTATION_PREFIXES.some((prefix) => path.includes(prefix));
  if (isApiMutation) {
    return c.json({ message: "Platform is in maintenance mode." }, 503);
  }

  await next();
};
