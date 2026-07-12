import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { flushMemoryLogs, setupMemoryLogger } from "#@/server/__tests__/helpers";
import { honoLogIngestionMiddleware } from "#@/server/hono/middleware";
import { LOG_INGEST_MAX_BATCH } from "#@/server/ingest/sanitize";

function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[index]!);
      index += 1;
    }
  });
}

function createIngestContext(options: {
  body: unknown;
  contentLength?: number | null;
  headers?: Record<string, string>;
}) {
  const serialized = new TextEncoder().encode(JSON.stringify(options.body));
  const headers = new Headers(options.headers);

  return {
    get: () => undefined,
    req: {
      header: (name: string) => {
        if (name === "content-length") {
          if (options.contentLength === null) return undefined;
          if (options.contentLength !== undefined) return String(options.contentLength);
          return String(serialized.byteLength);
        }
        return headers.get(name) ?? undefined;
      },
      raw: {
        headers,
        body: streamFromBytes(serialized)
      }
    },
    body: vi.fn((data: null, status: number) => {
      return { data, status };
    })
  };
}

describe("honoLogIngestionMiddleware", () => {
  beforeEach(() => {
    setupMemoryLogger("hono-ingest");
  });

  it("accepts batched client payloads and emits normalized server events", async () => {
    const middleware = honoLogIngestionMiddleware();
    const context = createIngestContext({
      body: [
        {
          event: {
            level: "error",
            event: "checkout_failed",
            message: "Card declined",
            timestamp: "2026-01-01T00:00:00.000Z"
          },
          request: {
            method: "POST",
            path: "/checkout?token=must-not-be-logged",
            requestId: "req-42"
          }
        },
        {
          event: {
            level: "info",
            event: "page_view",
            message: "Visited pricing"
          }
        },
        "not-a-drain-context"
      ]
    });

    const response = await middleware(context as never, async () => undefined);

    expect(response).toEqual({ data: null, status: 204 });

    const events = await flushMemoryLogs("hono-ingest");
    expect(events.find((entry) => entry.event === "checkout_failed")).toMatchObject({
      level: "error",
      clientTimestamp: "2026-01-01T00:00:00.000Z",
      source: "client"
    });
    expect(events.find((entry) => entry.event === "checkout_failed")).not.toHaveProperty(
      "requestId"
    );
    expect(events.find((entry) => entry.event === "checkout_failed")).not.toHaveProperty("path");
    expect(events.find((entry) => entry.event === "page_view")).toMatchObject({
      level: "info",
      source: "client"
    });
  });

  it("strips forged identity fields and applies server-owned metadata", async () => {
    const middleware = honoLogIngestionMiddleware({
      resolveIdentity: async () => {
        return { user: { id: "server-user" } };
      }
    });
    const context = createIngestContext({
      body: [
        {
          event: {
            level: "info",
            event: "custom",
            source: "forged",
            user: { id: "forged-user" },
            requestId: "forged-id",
            method: "PATCH",
            path: "/custom"
          },
          request: {
            method: "POST",
            path: "/ingest",
            requestId: "request-id"
          }
        }
      ],
      headers: { "x-request-id": "header-id" }
    });

    await middleware(context as never, async () => undefined);

    const events = await flushMemoryLogs("hono-ingest");
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        method: "PATCH",
        path: "/custom",
        requestId: "header-id",
        source: "client",
        user: { id: "server-user" }
      })
    );
    expect(events.at(-1)).not.toHaveProperty("forged");
  });

  it("returns 413 when Content-Length exceeds the configured limit", async () => {
    const middleware = honoLogIngestionMiddleware({ maxPayloadBytes: 32 });
    const context = createIngestContext({
      body: [{ event: { level: "info", event: "too_large" } }],
      contentLength: 64
    });

    await expect(middleware(context as never, async () => undefined)).rejects.toMatchObject({
      status: 413,
      message: "Log payload is too large"
    });
    await expect(middleware(context as never, async () => undefined)).rejects.toBeInstanceOf(
      HTTPException
    );
  });

  it("returns 413 for chunked bodies that exceed the limit without a Content-Length", async () => {
    const middleware = honoLogIngestionMiddleware({ maxPayloadBytes: 4 });
    const context = {
      get: () => undefined,
      req: {
        header: () => undefined,
        raw: {
          headers: new Headers(),
          body: streamFromChunks([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])])
        }
      },
      body: vi.fn()
    };

    await expect(middleware(context as never, async () => undefined)).rejects.toMatchObject({
      status: 413
    });
  });

  it("returns 400 for invalid JSON bodies", async () => {
    const middleware = honoLogIngestionMiddleware();
    const context = {
      get: () => undefined,
      req: {
        header: (name: string) => (name === "content-length" ? "5" : undefined),
        raw: {
          headers: new Headers(),
          body: streamFromBytes(new TextEncoder().encode("{bad"))
        }
      },
      body: vi.fn()
    };

    await expect(middleware(context as never, async () => undefined)).rejects.toMatchObject({
      status: 400,
      message: "Invalid JSON body"
    });
  });

  it("rejects huge batches", async () => {
    const middleware = honoLogIngestionMiddleware();
    const batch = Array.from({ length: LOG_INGEST_MAX_BATCH + 1 }, (_, index) => {
      return {
        event: { level: "info", event: `event_${index}` }
      };
    });
    const context = createIngestContext({ body: batch });

    await expect(middleware(context as never, async () => undefined)).rejects.toMatchObject({
      status: 413,
      message: "Log batch is too large"
    });
  });

  it("accepts non-array bodies as empty batches", async () => {
    const middleware = honoLogIngestionMiddleware();
    const context = createIngestContext({ body: { unexpected: true } });

    const response = await middleware(context as never, async () => undefined);

    expect(response).toEqual({ data: null, status: 204 });
    expect(await flushMemoryLogs("hono-ingest")).toEqual([]);
  });

  it("accepts payloads at the exact byte limit", async () => {
    const middleware = honoLogIngestionMiddleware({ maxPayloadBytes: 64 });
    const body = [{ event: { level: "info", event: "edge", message: "ok" } }];
    const bytes = new TextEncoder().encode(JSON.stringify(body));
    const context = {
      get: () => undefined,
      req: {
        header: (name: string) =>
          name === "content-length" ? String(bytes.byteLength) : undefined,
        raw: {
          headers: new Headers(),
          body: streamFromBytes(bytes)
        }
      },
      body: vi.fn((data: null, status: number) => {
        return { data, status };
      })
    };

    const response = await middleware(context as never, async () => undefined);
    expect(response).toEqual({ data: null, status: 204 });
  });
});
