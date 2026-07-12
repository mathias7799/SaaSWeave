export const LOG_INGEST_MAX_BYTES = 64 * 1024;
export const LOG_INGEST_MAX_BATCH = 25;
export const LOG_INGEST_MAX_DEPTH = 8;
export const LOG_INGEST_MAX_KEYS = 64;
export const LOG_INGEST_MAX_KEY_LENGTH = 128;
export const LOG_INGEST_MAX_STRING_LENGTH = 4_096;
export const LOG_INGEST_RATE_LIMIT = 120;
export const LOG_INGEST_RATE_WINDOW_SECONDS = 60;

/** Client payloads must not set or override these fields; the server owns them. */
export const SERVER_OWNED_LOG_FIELDS = [
  "_forceKeep",
  "_parentRequestId",
  "clientIp",
  "environment",
  "ip",
  "remoteIp",
  "requestId",
  "serverTimestamp",
  "service",
  "session",
  "source",
  "timestamp",
  "user",
  "version"
] as const;

export const POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const SECRET_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|api[_-]?key|access[_-]?token|refresh[_-]?token)/i;

export function isPollutionKey(key: string): boolean {
  return POLLUTION_KEYS.has(key);
}

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

type SanitizeValueOptions = {
  depth: number;
  key?: string;
};

export type SanitizedDrainEvent = Record<string, unknown>;

/**
 * Deterministically sanitize client log events: drop pollution keys, bound depth/key/string
 * counts, keep only JSON-safe scalar and container shapes, and redact secret-like values.
 */
export function sanitizeClientEvent(
  value: unknown,
  options: SanitizeValueOptions = { depth: 0 }
): SanitizedDrainEvent | string | number | boolean | null | unknown[] {
  if (options.depth >= LOG_INGEST_MAX_DEPTH) {
    return "[truncated:depth]";
  }

  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === "string") {
    const stringValue = value as string;
    if (options.key && isSecretKey(options.key)) {
      return "[redacted]";
    }
    if (stringValue.length > LOG_INGEST_MAX_STRING_LENGTH) {
      return `${stringValue.slice(0, LOG_INGEST_MAX_STRING_LENGTH)}…`;
    }
    return stringValue;
  }

  if (valueType === "number" || valueType === "boolean") {
    return value as number | boolean;
  }

  if (valueType !== "object") {
    return "[unsupported]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, LOG_INGEST_MAX_KEYS)
      .map((entry) => sanitizeClientEvent(entry, { depth: options.depth + 1 }));
  }

  const record = value as Record<string, unknown>;
  const sanitized: SanitizedDrainEvent = {};
  let keyCount = 0;

  for (const [key, entry] of Object.entries(record)) {
    if (isPollutionKey(key)) continue;
    if (SERVER_OWNED_LOG_FIELDS.includes(key as (typeof SERVER_OWNED_LOG_FIELDS)[number])) {
      continue;
    }
    if (key.length > LOG_INGEST_MAX_KEY_LENGTH) continue;
    if (keyCount >= LOG_INGEST_MAX_KEYS) break;

    sanitized[key] = sanitizeClientEvent(entry, { depth: options.depth + 1, key });
    keyCount += 1;
  }

  return sanitized;
}

export function redactSecrets(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    if (typeof value === "string" && SECRET_KEY_PATTERN.test(value)) {
      return "[redacted]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }

  const record = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (isPollutionKey(key)) continue;
    if (isSecretKey(key)) {
      redacted[key] = "[redacted]";
      continue;
    }
    redacted[key] = redactSecrets(entry);
  }
  return redacted;
}
