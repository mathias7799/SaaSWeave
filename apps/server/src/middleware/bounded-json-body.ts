import { createMiddleware } from "hono/factory";

import {
  DEFAULT_JSON_BODY_MAX_BYTES,
  readBoundedRequestOrNull,
  replaceRequestBody
} from "@saasweave/core/security";

type BoundedJsonBodyOptions = {
  defaultMaxBytes?: number;
  excludePath?: RegExp;
  pathLimits?: Array<{ match: RegExp; maxBytes: number }>;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match only routes owned by the configured API base path, never substring lookalikes. */
export function buildApiBodyLimitExclusionPattern(apiBasePath: string): RegExp {
  const normalizedBasePath = `/${apiBasePath}`.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  const basePrefix = normalizedBasePath === "/" ? "" : escapeRegExp(normalizedBasePath);
  return new RegExp(
    `^${basePrefix}/(?:auth(?:/|$)|media(?:/|$)|exports(?:/|$)|stripe/webhook/?$|_logs/ingest/?$|health(?:/|$))`
  );
}

function resolveMaxBytes(pathname: string, options: BoundedJsonBodyOptions): number | null {
  if (options.excludePath?.test(pathname)) {
    return null;
  }

  for (const rule of options.pathLimits ?? []) {
    if (rule.match.test(pathname)) {
      return rule.maxBytes;
    }
  }

  return options.defaultMaxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES;
}

/**
 * Bound JSON request bodies for RPC/OpenAPI handlers while preserving the exact bytes for
 * downstream parsers.
 */
export function boundedJsonBodyMiddleware(options: BoundedJsonBodyOptions = {}) {
  return createMiddleware<{
    Variables: {
      boundedRequest?: Request;
    };
  }>(async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    const maxBytes = resolveMaxBytes(pathname, options);

    if (maxBytes === null || !["POST", "PUT", "PATCH"].includes(c.req.method)) {
      await next();
      return;
    }

    const contentType = c.req.header("content-type") ?? "";
    const isJson =
      contentType.includes("application/json") ||
      contentType.includes("+json") ||
      pathname.includes("/rpc");

    if (!isJson) {
      await next();
      return;
    }

    const body = await readBoundedRequestOrNull(c.req.raw, maxBytes);
    if (body === null) return c.json({ message: "Request body is too large" }, 413);

    c.set("boundedRequest", replaceRequestBody(c.req.raw, body));
    await next();
  });
}
