import { describe, expect, it } from "vite-plus/test";

import {
  isPollutionKey,
  LOG_INGEST_MAX_BATCH,
  LOG_INGEST_MAX_DEPTH,
  LOG_INGEST_MAX_STRING_LENGTH,
  redactSecrets,
  sanitizeClientEvent
} from "#@/server/ingest/sanitize";

describe("sanitizeClientEvent", () => {
  it("drops prototype-pollution keys and server-owned fields", () => {
    const sanitized = sanitizeClientEvent({
      level: "info",
      event: "forged",
      source: "attacker",
      user: { id: "forged-user" },
      requestId: "forged-id",
      __proto__: { polluted: true },
      constructor: { name: "Object" },
      prototype: { bad: true }
    });

    expect(sanitized).toEqual(
      expect.objectContaining({
        event: "forged",
        level: "info"
      })
    );
    expect(sanitized).not.toHaveProperty("source");
    expect(sanitized).not.toHaveProperty("user");
    expect(sanitized).not.toHaveProperty("requestId");
    expect(isPollutionKey("__proto__")).toBe(true);
  });

  it("truncates deep payloads deterministically", () => {
    const deep: Record<string, unknown> = { level: "info", event: "deep" };
    let cursor = deep;
    for (let index = 0; index < LOG_INGEST_MAX_DEPTH + 2; index += 1) {
      cursor.nested = { level: "info" };
      cursor = cursor.nested as Record<string, unknown>;
    }

    const sanitized = sanitizeClientEvent(deep) as Record<string, unknown>;
    expect(JSON.stringify(sanitized)).toContain("[truncated:depth]");
  });

  it("bounds string length", () => {
    const sanitized = sanitizeClientEvent({
      level: "info",
      message: "x".repeat(LOG_INGEST_MAX_STRING_LENGTH + 10)
    }) as Record<string, unknown>;

    expect(String(sanitized.message)).toHaveLength(LOG_INGEST_MAX_STRING_LENGTH + 1);
    expect(String(sanitized.message).endsWith("…")).toBe(true);
  });
});

describe("redactSecrets", () => {
  it("redacts secret-like keys after normalization", () => {
    expect(
      redactSecrets({
        apiKey: "swv_live_secret",
        nested: { accessToken: "tok_123" }
      })
    ).toEqual({
      apiKey: "[redacted]",
      nested: { accessToken: "[redacted]" }
    });
  });
});

describe("LOG_INGEST_MAX_BATCH", () => {
  it("documents the batch ceiling used by middleware", () => {
    expect(LOG_INGEST_MAX_BATCH).toBe(25);
  });
});
