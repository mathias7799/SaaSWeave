export const DEFAULT_JSON_BODY_MAX_BYTES = 1_048_576;
/** Maximum exact raw Stripe webhook body: 1 MiB, including chunked requests. */
export const STRIPE_WEBHOOK_MAX_BYTES = 1_048_576;
export const LOG_INGEST_MAX_BYTES = 64 * 1024;

export class BoundedBodyError extends Error {
  readonly status = 413;

  constructor(message = "Request body is too large") {
    super(message);
    this.name = "BoundedBodyError";
  }
}

/**
 * Parse Content-Length when present. Returns null for missing, invalid, or negative values.
 */
export function parseContentLength(header: string | null | undefined): number | null {
  if (header === undefined || header === null || header.trim() === "") {
    return null;
  }

  const normalized = header.trim().toLowerCase();
  if (normalized === "false" || normalized === "undefined" || normalized === "null") {
    return null;
  }

  const value = Number.parseInt(header, 10);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

export function assertContentLengthWithinLimit(
  contentLength: number | null,
  maxBytes: number
): void {
  if (contentLength !== null && contentLength > maxBytes) {
    throw new BoundedBodyError();
  }
}

type ReadBoundedRequestBodyOptions = {
  contentLength?: number | null;
  maxBytes: number;
  stream: ReadableStream<Uint8Array> | null;
};

/**
 * Read up to `maxBytes` from a request body stream. Rejects early when Content-Length exceeds
 * the limit and stops reading (without buffering the remainder) once the streamed byte count
 * exceeds `maxBytes`.
 */
export async function readBoundedRequestBody(
  options: ReadBoundedRequestBodyOptions
): Promise<Uint8Array> {
  const { maxBytes, stream } = options;
  const contentLength = options.contentLength ?? null;

  assertContentLengthWithinLimit(contentLength, maxBytes);

  if (!stream) {
    return new Uint8Array(0);
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      const remaining = maxBytes - total;
      if (remaining <= 0) {
        await reader.cancel();
        throw new BoundedBodyError();
      }

      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        await reader.cancel();
        throw new BoundedBodyError();
      }

      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    if (error instanceof BoundedBodyError) {
      throw error;
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    return new Uint8Array(0);
  }

  if (chunks.length === 1) {
    return chunks[0]!;
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Read a bounded body and represent an exceeded limit as null while preserving other failures. */
export async function readBoundedRequestBodyOrNull(
  options: ReadBoundedRequestBodyOptions
): Promise<Uint8Array | null> {
  try {
    return await readBoundedRequestBody(options);
  } catch (error) {
    if (error instanceof BoundedBodyError) return null;
    throw error;
  }
}

/**
 * Drain a request body without retaining bytes. Used after rejecting oversized payloads.
 */
export async function drainRequestBody(stream: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!stream) return;

  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch {
    // Best-effort drain after rejection.
  } finally {
    reader.releaseLock();
  }
}

export async function readBoundedRequest(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLength = parseContentLength(request.headers.get("content-length"));
  return readBoundedRequestBody({
    contentLength,
    maxBytes,
    stream: request.body
  });
}

export async function readBoundedRequestOrNull(
  request: Request,
  maxBytes: number
): Promise<Uint8Array | null> {
  return readBoundedRequestBodyOrNull({
    contentLength: parseContentLength(request.headers.get("content-length")),
    maxBytes,
    stream: request.body
  });
}

export function replaceRequestBody(request: Request, body: Uint8Array): Request {
  const headers = new Headers(request.headers);
  headers.set("content-length", String(body.byteLength));

  return new Request(request.url, {
    body: body as BodyInit,
    // Required by Node fetch when reusing a consumed stream body.
    duplex: "half",
    headers,
    method: request.method,
    redirect: request.redirect,
    signal: request.signal
  } as RequestInit);
}
