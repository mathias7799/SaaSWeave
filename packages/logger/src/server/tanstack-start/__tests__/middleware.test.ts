import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  flushMemoryLogs,
  runRequestMiddleware,
  setupMemoryLogger
} from "#@/server/__tests__/helpers";
import {
  tanstackStartRequestLoggerMiddleware,
  tanstackStartServerFnLoggerMiddleware
} from "#@/server/tanstack-start/middleware";

function createRequest(url: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request(url, init);
}

describe("tanstackStartRequestLoggerMiddleware", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    setupMemoryLogger("tanstack-request");
  });

  it("builds request context, attaches logger, and emits a wide event on success", async () => {
    const middleware = tanstackStartRequestLoggerMiddleware({
      context: { feature: "billing" }
    });
    const request = createRequest("https://example.com/api/users?page=1", {
      method: "GET",
      headers: {
        "X-Request-Id": "req-123",
        "cf-connecting-ip": "203.0.113.1"
      }
    });

    const result = await runRequestMiddleware(middleware, {
      request,
      handler: async ({ context }) => {
        context.logger.set({ outcome: "ok" });
        return { context };
      }
    });

    expect(result.context).toEqual(
      expect.objectContaining({
        requestId: "req-123",
        request: {
          hostname: "example.com",
          ip: "203.0.113.1",
          method: "GET",
          path: "/api/users",
          query: { page: "1" }
        },
        logger: expect.objectContaining({
          set: expect.any(Function),
          emit: expect.any(Function)
        })
      })
    );

    const events = await flushMemoryLogs("tanstack-request");
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        requestId: "req-123",
        method: "GET",
        path: "/api/users",
        ip: "203.0.113.1",
        feature: "billing",
        outcome: "ok"
      })
    );
  });

  it("generates a request id when the incoming header is invalid", async () => {
    const middleware = tanstackStartRequestLoggerMiddleware({
      requestIdOptions: {
        generator: () => "generated-id"
      }
    });
    const request = createRequest("https://example.com/profile", {
      headers: { "X-Request-Id": "bad id with spaces" }
    });

    const result = await runRequestMiddleware(middleware, {
      request,
      handler: ({ context }) => {
        context.logger.set({ ok: true });
        return { context };
      }
    });

    expect(result.context.requestId).toBe("generated-id");
  });

  it("skips emission for excluded paths and client ips", async () => {
    const middleware = tanstackStartRequestLoggerMiddleware({
      excludePaths: ["/health", "/assets/*"],
      excludeIps: ["::ffff:10.0.0.5", "198.51.100.2"]
    });

    const healthRequest = createRequest("https://example.com/health", {
      headers: { "x-real-ip": "203.0.113.9" }
    });
    await runRequestMiddleware(middleware, {
      request: healthRequest,
      handler: ({ context }) => {
        context.logger.set({ skipped: "health" });
        return { context };
      }
    });

    const assetRequest = createRequest("https://example.com/assets/app.js", {
      headers: { "x-real-ip": "203.0.113.9" }
    });
    await runRequestMiddleware(middleware, {
      request: assetRequest,
      handler: ({ context }) => {
        context.logger.set({ skipped: "asset" });
        return { context };
      }
    });

    const excludedIpRequest = createRequest("https://example.com/api/data", {
      headers: { "x-real-ip": "10.0.0.5" }
    });
    await runRequestMiddleware(middleware, {
      request: excludedIpRequest,
      handler: ({ context }) => {
        context.logger.set({ skipped: "ip" });
        return { context };
      }
    });

    expect(await flushMemoryLogs("tanstack-request")).toEqual([]);
  });

  it("matches wildcard path patterns including double-star segments", async () => {
    const middleware = tanstackStartRequestLoggerMiddleware({
      excludePaths: ["/api/**/internal"]
    });
    const request = createRequest("https://example.com/api/v2/internal", {
      headers: { "x-real-ip": "203.0.113.9" }
    });

    await runRequestMiddleware(middleware, {
      request,
      handler: ({ context }) => {
        context.logger.set({ skipped: "wildcard" });
        return { context };
      }
    });

    expect(await flushMemoryLogs("tanstack-request")).toEqual([]);
  });

  it("emits on error and rethrows the original failure", async () => {
    const middleware = tanstackStartRequestLoggerMiddleware();
    const request = createRequest("https://example.com/api/fail", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.2, 10.0.0.1" }
    });

    await expect(
      runRequestMiddleware(middleware, {
        request,
        handler: async () => {
          throw new Error("handler failed");
        }
      })
    ).rejects.toThrow("handler failed");

    const events = await flushMemoryLogs("tanstack-request");
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        method: "POST",
        path: "/api/fail",
        ip: "203.0.113.2",
        level: "error"
      })
    );
  });

  it("wraps non-Error throws before logging and rethrowing", async () => {
    const middleware = tanstackStartRequestLoggerMiddleware();
    const request = createRequest("https://example.com/api/fail-string");

    await expect(
      runRequestMiddleware(middleware, {
        request,
        handler: async () => {
          throw "plain failure";
        }
      })
    ).rejects.toBe("plain failure");

    const events = await flushMemoryLogs("tanstack-request");
    expect(events.at(-1)?.level).toBe("error");
  });

  it("derives client ip from forwarded and true-client headers", async () => {
    const middleware = tanstackStartRequestLoggerMiddleware();
    const cases = [
      {
        headers: { "true-client-ip": "198.51.100.10" },
        ip: "198.51.100.10"
      },
      {
        headers: { "x-client-ip": "198.51.100.11" },
        ip: "198.51.100.11"
      },
      {
        headers: { forwarded: "for=203.0.113.55;proto=https" },
        ip: "203.0.113.55"
      }
    ] as const;

    for (const testCase of cases) {
      const request = createRequest("https://example.com/api/ip", {
        headers: testCase.headers
      });

      const result = await runRequestMiddleware(middleware, {
        request,
        handler: ({ context }) => {
          context.logger.set({ probe: testCase.ip });
          return { context };
        }
      });

      expect(result.context.request.ip).toBe(testCase.ip);
    }
  });
});

describe("tanstackStartServerFnLoggerMiddleware", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    setupMemoryLogger("tanstack-function");
  });

  it("logs function middleware requests while honoring ip exclusions", async () => {
    const middleware = tanstackStartServerFnLoggerMiddleware({
      context: { scope: "server-fn" },
      excludeIps: ["203.0.113.99"]
    });

    const allowedRequest = createRequest("https://example.com/fn/allowed", {
      method: "PUT",
      headers: { "x-real-ip": "203.0.113.1", "X-Request-Id": "fn-1" }
    });

    await runRequestMiddleware(middleware, {
      request: allowedRequest,
      handler: ({ context }) => {
        context.logger.set({ allowed: true });
        return { context };
      }
    });

    const excludedRequest = createRequest("https://example.com/fn/blocked", {
      headers: { "x-real-ip": "203.0.113.99", "X-Request-Id": "fn-2" }
    });

    await runRequestMiddleware(middleware, {
      request: excludedRequest,
      handler: ({ context }) => {
        context.logger.set({ allowed: false });
        return { context };
      }
    });

    const events = await flushMemoryLogs("tanstack-function");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        scope: "server-fn",
        allowed: true,
        method: "PUT",
        path: "/fn/allowed",
        requestId: "fn-1"
      })
    );
  });

  it("respects custom request id headers and generators", async () => {
    const generator = vi.fn(() => "generated-fn-id");
    const middleware = tanstackStartServerFnLoggerMiddleware({
      requestIdOptions: {
        headerName: "X-Correlation-Id",
        generator
      }
    });
    const request = createRequest("https://example.com/fn/create", {
      headers: { "X-Correlation-Id": "corr-123" }
    });

    const result = await runRequestMiddleware(middleware, {
      request,
      handler: ({ context }) => {
        context.logger.set({ ok: true });
        return { context };
      }
    });

    expect(result.context.requestId).toBe("corr-123");
    expect(generator).not.toHaveBeenCalled();
  });
});

// Full TanStack Start runtime wiring is validated in app integration tests; unit tests
// exercise middleware composition through a minimal server middleware runner.
