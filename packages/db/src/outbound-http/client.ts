import { type LookupOptions } from "node:dns";
import { lookup as defaultLookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { type LookupFunction } from "node:net";
import { type Socket } from "node:net";

import {
  OUTBOUND_HTTP_LIMITS,
  assertOutboundAddressesAllowed,
  outboundOriginsMatch,
  parseOutboundUrl
} from "@saasweave/core/security";

import {
  OutboundHttpError,
  type DnsLookupResult,
  type DnsResolver,
  type HardenedOutboundRequestInput,
  type HardenedOutboundResponse,
  type OutboundHttpDeps,
  type PinnedRequestExecutor
} from "#@/outbound-http/types";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const defaultResolver: DnsResolver = async (hostname) => {
  const results = await defaultLookup(hostname, { all: true });
  return results.map((entry) => {
    return {
      address: entry.address,
      family: entry.family === 6 ? 6 : 4
    };
  });
};

function createPinnedLookup(pinnedAddress: string, family: 4 | 6): LookupFunction {
  return ((
    _hostname: string,
    _options: LookupOptions,
    callback:
      | ((err: NodeJS.ErrnoException | null, address: string, family: number) => void)
      | ((
          err: NodeJS.ErrnoException | null,
          addresses: Array<{ address: string; family: number }>
        ) => void)
  ) => {
    if (_options.all) {
      (
        callback as (
          err: NodeJS.ErrnoException | null,
          addresses: Array<{ address: string; family: number }>
        ) => void
      )(null, [{ address: pinnedAddress, family }]);
      return;
    }

    (callback as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)(
      null,
      pinnedAddress,
      family
    );
  }) as LookupFunction;
}

function normalizeHeaders(headers: IncomingMessage["headers"]): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return normalized;
}

function resolveRedirectUrl(currentUrl: string, location: string): string {
  return new URL(location, currentUrl).toString();
}

function stripSensitiveHeaders(
  headers: Record<string, string>,
  sensitiveHeaders: string[]
): Record<string, string> {
  if (sensitiveHeaders.length === 0) return headers;
  const blocked = new Set(sensitiveHeaders.map((header) => header.toLowerCase()));
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !blocked.has(key.toLowerCase()))
  );
}

async function resolveValidatedAddresses(
  hostname: string,
  resolver: DnsResolver
): Promise<DnsLookupResult[]> {
  const results = await resolver(hostname);
  if (results.length === 0) {
    throw new OutboundHttpError("network_error", "dns_empty");
  }
  const blocked = assertOutboundAddressesAllowed(results.map((entry) => entry.address));
  if (blocked) {
    throw new OutboundHttpError(blocked);
  }
  return results;
}

async function readBoundedBody(
  stream: IncomingMessage,
  maxBytes: number,
  idleTimeoutMs: number,
  signal?: AbortSignal
): Promise<{ body: string; truncated: boolean }> {
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;

  await new Promise<void>((resolve, reject) => {
    let idleTimer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer);
      stream.off("data", onData);
      stream.off("end", onEnd);
      stream.off("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        cleanup();
        stream.destroy();
        reject(new OutboundHttpError("timeout", "body_idle_timeout"));
      }, idleTimeoutMs);
    };

    const onData = (chunk: Buffer) => {
      resetIdleTimer();
      if (total >= maxBytes) {
        truncated = true;
        stream.destroy();
        cleanup();
        resolve();
        return;
      }
      const remaining = maxBytes - total;
      const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
      chunks.push(slice);
      total += slice.length;
      if (chunk.length > remaining) {
        truncated = true;
        stream.destroy();
        cleanup();
        resolve();
      }
    };

    const onEnd = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onAbort = () => {
      cleanup();
      stream.destroy();
      reject(new OutboundHttpError("timeout", "aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    resetIdleTimer();
    stream.on("data", onData);
    stream.on("end", onEnd);
    stream.on("error", onError);
  });

  return { body: Buffer.concat(chunks).toString("utf8"), truncated };
}

export const defaultRequestExecutor: PinnedRequestExecutor = (input) => {
  const { parsed, pinned, method, headers, body, signal, connectTimeoutMs, headersTimeoutMs } =
    input;
  const isHttps = parsed.protocol === "https:";
  const path = `${parsed.url.pathname}${parsed.url.search}`;

  const requestOptions: RequestOptions = {
    headers: {
      ...headers,
      Host: parsed.url.host
    },
    hostname: parsed.hostname,
    lookup: createPinnedLookup(pinned.address, pinned.family),
    method,
    path,
    port: parsed.port,
    protocol: parsed.protocol,
    setHost: false,
    signal,
    ...(isHttps ? { servername: parsed.hostname } : {})
  };

  const requestFn = isHttps ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    let connectTimer: NodeJS.Timeout | undefined;
    let connectedSocket: Socket | undefined;

    const clearConnectTimer = () => {
      if (connectTimer) clearTimeout(connectTimer);
      connectTimer = undefined;
    };

    const req = requestFn(requestOptions, (res) => {
      clearConnectTimer();
      if (headersTimer) clearTimeout(headersTimer);
      resolve(res);
    });

    connectTimer = setTimeout(() => {
      req.destroy(new OutboundHttpError("timeout", "connect_timeout"));
    }, connectTimeoutMs);

    req.once("socket", (socket) => {
      connectedSocket = socket;
      const connectEvent = isHttps ? "secureConnect" : "connect";
      const alreadyConnected = req.reusedSocket || (!isHttps && !socket.connecting);

      if (alreadyConnected) {
        clearConnectTimer();
        return;
      }

      socket.once(connectEvent, clearConnectTimer);
    });

    const headersTimer = setTimeout(() => {
      req.destroy(new OutboundHttpError("timeout", "headers_timeout"));
    }, headersTimeoutMs);

    req.on("error", (error) => {
      clearConnectTimer();
      if (headersTimer) clearTimeout(headersTimer);
      connectedSocket?.off(isHttps ? "secureConnect" : "connect", clearConnectTimer);
      if (error.name === "AbortError") {
        reject(new OutboundHttpError("timeout", "aborted"));
        return;
      }
      reject(error);
    });

    signal?.addEventListener(
      "abort",
      () => {
        req.destroy(new OutboundHttpError("timeout", "aborted"));
      },
      { once: true }
    );

    if (body) {
      req.write(body);
    }
    req.end();
  });
};

type ResolvedOutboundHttpDeps = {
  request: PinnedRequestExecutor;
  resolver: DnsResolver;
};

async function executeHop(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  deps: ResolvedOutboundHttpDeps,
  signal?: AbortSignal
): Promise<IncomingMessage> {
  const parsed = parseOutboundUrl(url);
  if (!parsed.ok) {
    throw new OutboundHttpError(parsed.error);
  }

  const addresses = await resolveValidatedAddresses(parsed.value.hostname, deps.resolver);
  let lastError: unknown;
  for (const pinned of addresses) {
    try {
      return await deps.request({
        body,
        connectTimeoutMs: OUTBOUND_HTTP_LIMITS.CONNECT_TIMEOUT_MS,
        headers,
        headersTimeoutMs: OUTBOUND_HTTP_LIMITS.HEADERS_TIMEOUT_MS,
        method,
        parsed: parsed.value,
        pinned,
        signal
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof OutboundHttpError) {
    throw lastError;
  }
  throw new OutboundHttpError("network_error", "connect_failed");
}

function createTimeoutSignal(
  parentSignal: AbortSignal | undefined,
  totalTimeoutMs: number
): { cleanup: () => void; signal: AbortSignal } {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new OutboundHttpError("timeout", "total_timeout"));
  }, totalTimeoutMs);

  const onParentAbort = () => {
    controller.abort(parentSignal?.reason);
  };
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  return {
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", onParentAbort);
    },
    signal: controller.signal
  };
}

export async function hardenedOutboundRequest(
  input: HardenedOutboundRequestInput
): Promise<HardenedOutboundResponse> {
  if (input.body !== undefined) {
    const bodyBytes = Buffer.byteLength(input.body, "utf8");
    if (bodyBytes > OUTBOUND_HTTP_LIMITS.MAX_REQUEST_BODY_BYTES) {
      throw new OutboundHttpError("payload_too_large");
    }
  }

  const deps: ResolvedOutboundHttpDeps = {
    request: input.deps?.request ?? defaultRequestExecutor,
    resolver: input.deps?.resolver ?? defaultResolver
  };

  const followRedirects = input.followRedirects ?? true;
  const maxRedirects = input.maxRedirects ?? OUTBOUND_HTTP_LIMITS.MAX_REDIRECTS;
  const sensitiveHeaders = input.sensitiveHeaders ?? [];
  const initialUrl = input.url;
  let currentUrl = input.url;
  let currentMethod = input.method;
  let currentHeaders = { ...input.headers };
  let redirectCount = 0;

  const { signal, cleanup } = createTimeoutSignal(
    input.signal,
    OUTBOUND_HTTP_LIMITS.TOTAL_TIMEOUT_MS
  );

  try {
    while (true) {
      const response = await executeHop(
        currentUrl,
        currentMethod,
        currentHeaders,
        currentMethod === "GET" || currentMethod === "HEAD" ? undefined : input.body,
        deps,
        signal
      );

      if (followRedirects && REDIRECT_STATUSES.has(response.statusCode ?? 0)) {
        if (redirectCount >= maxRedirects) {
          throw new OutboundHttpError("redirect_loop");
        }

        const location = normalizeHeaders(response.headers).location;
        if (!location) {
          throw new OutboundHttpError("network_error", "redirect_missing_location");
        }

        const nextUrl = resolveRedirectUrl(currentUrl, location);
        if (!outboundOriginsMatch(initialUrl, nextUrl)) {
          throw new OutboundHttpError("redirect_to_different_origin");
        }

        response.resume();
        redirectCount += 1;
        currentUrl = nextUrl;

        if (
          response.statusCode === 303 ||
          (response.statusCode === 302 && currentMethod === "POST")
        ) {
          currentMethod = "GET";
          currentHeaders = stripSensitiveHeaders(currentHeaders, sensitiveHeaders);
        }

        continue;
      }

      const { body, truncated } = await readBoundedBody(
        response,
        OUTBOUND_HTTP_LIMITS.MAX_RESPONSE_BODY_BYTES,
        OUTBOUND_HTTP_LIMITS.BODY_IDLE_TIMEOUT_MS,
        signal
      );

      return {
        body,
        headers: normalizeHeaders(response.headers),
        status: response.statusCode ?? 0,
        truncated
      };
    }
  } finally {
    cleanup();
  }
}

export async function assertPublicWebhookUrl(
  rawUrl: string,
  deps?: OutboundHttpDeps
): Promise<void> {
  const parsed = parseOutboundUrl(rawUrl);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const resolver = deps?.resolver ?? defaultResolver;
  await resolveValidatedAddresses(parsed.value.hostname, resolver);
}
