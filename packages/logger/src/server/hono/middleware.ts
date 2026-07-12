import { log, type DrainContext, type LogLevel } from "evlog";
import {
  evlog as createEvlogHonoMiddleware,
  type EvlogHonoOptions,
  type EvlogVariables
} from "evlog/hono";
import { type Context, type MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { LOG_INGEST_MAX_BYTES, readBoundedRequestOrNull } from "@saasweave/core/security";

import {
  LOG_INGEST_MAX_BATCH,
  redactSecrets,
  sanitizeClientEvent,
  SERVER_OWNED_LOG_FIELDS
} from "#@/server/ingest/sanitize";

const VALID_LEVELS = new Set<LogLevel>(["info", "error", "warn", "debug"]);

/**
 * Hono app variables added by `honoLoggerMiddleware()`.
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { type HonoLogVariables } from "@saasweave/logger/server/hono/middleware";
 *
 * const app = new Hono<HonoLogVariables>();
 * ```
 */
export type HonoLogVariables = EvlogVariables;

type HonoLoggerMiddlewareOptions = EvlogHonoOptions;

type IngestRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type HonoLogIngestionOptions = {
  checkRateLimit?: (key: string) => Promise<IngestRateLimitResult>;
  getSocketAddress?: (context: Context) => string | null | undefined;
  maxPayloadBytes?: number;
  resolveClientIp?: (args: { headers: Headers; socketAddress?: string | null }) => string;
  resolveIdentity?: (headers: Headers) => Promise<Record<string, unknown> | null>;
};

/**
 * Add evlog request logging to a Hono app and expose the request logger as `c.get("log")`.
 *
 * @example
 * ```ts
 * import { honoLoggerMiddleware } from "@saasweave/logger/server/hono/middleware";
 *
 * app.use("/*", honoLoggerMiddleware());
 * app.get("/health", (c) => {
 *   c.get("log").set({ health: { live: true } });
 *   return c.json({ status: "healthy" });
 * });
 * ```
 */
export function honoLoggerMiddleware(options?: HonoLoggerMiddlewareOptions): MiddlewareHandler {
  return createEvlogHonoMiddleware(options);
}

/**
 * Accept browser log events posted by `@saasweave/logger/client`.
 *
 * @see ../INGEST-AUTH.md
 *
 * @example
 * ```ts
 * import { honoLogIngestionMiddleware } from "@saasweave/logger/server/hono/middleware";
 *
 * app.post("/_logs/ingest", honoLogIngestionMiddleware());
 * ```
 */
export function honoLogIngestionMiddleware(
  options: HonoLogIngestionOptions = {}
): MiddlewareHandler {
  const maxPayloadBytes = options.maxPayloadBytes ?? LOG_INGEST_MAX_BYTES;

  return createMiddleware(async (c) => {
    const clientIp = options.resolveClientIp?.({
      headers: c.req.raw.headers,
      socketAddress: options.getSocketAddress?.(c) ?? null
    });

    if (clientIp && options.checkRateLimit) {
      const rate = await options.checkRateLimit(`logs:ingest:${clientIp}`);
      if (!rate.allowed) {
        throw new HTTPException(429, {
          message: `Log ingest rate limit exceeded. Try again in ${rate.retryAfterSeconds} seconds.`
        });
      }
    }

    const rawBody = await readBoundedRequestOrNull(c.req.raw, maxPayloadBytes);
    if (rawBody === null) {
      throw new HTTPException(413, { message: "Log payload is too large" });
    }

    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      throw new HTTPException(400, { message: "Invalid JSON body" });
    }

    const batch = normalizeBatch(body);
    const identity = (await options.resolveIdentity?.(c.req.raw.headers)) ?? null;
    const requestId = c.req.header("x-request-id") ?? c.get("log")?.event?.requestId ?? undefined;
    const serverTimestamp = new Date().toISOString();

    for (const payload of batch) {
      emitClientLog(payload, {
        clientIp,
        identity,
        requestId,
        serverTimestamp
      });
    }

    return c.body(null, 204);
  });
}

function normalizeBatch(body: unknown): DrainContext[] {
  if (!Array.isArray(body)) {
    return [];
  }

  if (body.length > LOG_INGEST_MAX_BATCH) {
    throw new HTTPException(413, { message: "Log batch is too large" });
  }

  return body.filter(isDrainContext);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isDrainContext(value: unknown): value is DrainContext {
  return isRecord(value) && isRecord(value.event);
}

function normalizeLevel(value: unknown): LogLevel {
  if (typeof value !== "string" || !VALID_LEVELS.has(value as LogLevel)) {
    return "info";
  }

  return value as LogLevel;
}

type EmitClientLogContext = {
  clientIp?: string;
  identity: Record<string, unknown> | null;
  requestId?: string;
  serverTimestamp: string;
};

function emitClientLog(payload: DrainContext, context: EmitClientLogContext) {
  const rawTimestamp =
    typeof payload.event.timestamp === "string"
      ? payload.event.timestamp
      : typeof payload.event.clientTimestamp === "string"
        ? payload.event.clientTimestamp
        : undefined;

  const sanitizedEvent = sanitizeClientEvent(payload.event);
  if (!isRecord(sanitizedEvent)) {
    return;
  }

  const { level: _level, timestamp: _timestamp, ...eventFields } = sanitizedEvent;
  const normalizedEvent: Record<string, unknown> = {
    ...(rawTimestamp && eventFields.clientTimestamp === undefined
      ? { clientTimestamp: rawTimestamp }
      : {}),
    ...eventFields
  };

  for (const key of SERVER_OWNED_LOG_FIELDS) {
    delete normalizedEvent[key];
  }

  const clientEvent = redactSecrets({
    ...normalizedEvent,
    ...(context.clientIp ? { clientIp: context.clientIp } : {}),
    ...context.identity,
    ...(context.requestId ? { requestId: context.requestId } : {}),
    serverTimestamp: context.serverTimestamp,
    source: "client"
  }) as Record<string, unknown>;

  switch (normalizeLevel(payload.event.level)) {
    case "debug":
      log.debug(clientEvent);
      return;
    case "error":
      log.error(clientEvent);
      return;
    case "warn":
      log.warn(clientEvent);
      return;
    case "info":
      log.info(clientEvent);
      return;
  }
}
