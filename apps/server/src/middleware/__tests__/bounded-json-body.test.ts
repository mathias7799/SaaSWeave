import { describe, expect, it, vi } from "vite-plus/test";

import {
  boundedJsonBodyMiddleware,
  buildApiBodyLimitExclusionPattern
} from "#@/middleware/bounded-json-body";

function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

describe("boundedJsonBodyMiddleware", () => {
  function context(input: {
    body?: Uint8Array;
    contentType?: string;
    method?: string;
    url: string;
  }) {
    const body = input.body ?? new TextEncoder().encode("{}");
    const method = input.method ?? "POST";
    return {
      json: (payload: unknown, status: number) => {
        return { payload, status };
      },
      req: {
        header: (name: string) => {
          if (name === "content-type") return input.contentType;
          if (name === "content-length") return String(body.byteLength);
          return undefined;
        },
        method,
        raw: new Request(input.url, {
          ...(method === "GET" || method === "HEAD"
            ? {}
            : { body: streamFromBytes(body), duplex: "half" }),
          headers: { "content-type": input.contentType ?? "application/json" },
          method
        } as RequestInit),
        url: input.url
      },
      set: vi.fn()
    } as never;
  }

  it("rejects oversized JSON bodies with 413", async () => {
    const middleware = boundedJsonBodyMiddleware({ defaultMaxBytes: 8 });
    const body = new TextEncoder().encode('{"hello":"world"}');
    const response = await middleware(
      {
        json: (payload: unknown, status: number) => {
          return { payload, status };
        },
        req: {
          header: (name: string) => {
            if (name === "content-type") return "application/json";
            if (name === "content-length") return String(body.byteLength);
            return undefined;
          },
          method: "POST",
          raw: {
            body: streamFromBytes(body),
            headers: new Headers({ "content-type": "application/json" })
          },
          url: "http://localhost:5000/server/rpc/test"
        },
        set: () => undefined
      } as never,
      async () => undefined
    );

    expect(response).toEqual({
      payload: { message: "Request body is too large" },
      status: 413
    });
  });

  it("skips excluded paths", async () => {
    const middleware = boundedJsonBodyMiddleware({
      defaultMaxBytes: 4,
      excludePath: /\/stripe\/webhook/
    });
    const body = new TextEncoder().encode("0123456789");
    let nextCalled = false;

    await middleware(
      {
        json: () => {
          return { payload: {}, status: 413 };
        },
        req: {
          header: () => "application/json",
          method: "POST",
          raw: {
            body: streamFromBytes(body),
            headers: new Headers()
          },
          url: "http://localhost:5000/server/stripe/webhook"
        },
        set: () => undefined
      } as never,
      async () => {
        nextCalled = true;
      }
    );

    expect(nextCalled).toBe(true);
  });

  it.each([
    { contentType: "application/json", method: "GET", label: "read-only methods" },
    { contentType: "text/plain", method: "POST", label: "non-JSON writes" }
  ])("passes through $label", async ({ contentType, method }) => {
    const next = vi.fn();
    await boundedJsonBodyMiddleware({ defaultMaxBytes: 8 })(
      context({ contentType, method, url: "http://localhost/server/rpc/test" }),
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("replays accepted JSON through the bounded request context", async () => {
    const next = vi.fn();
    const ctx = context({
      body: new TextEncoder().encode('{"ok":true}'),
      contentType: "application/problem+json",
      url: "http://localhost/server/rpc/test"
    }) as { set: ReturnType<typeof vi.fn> };

    await boundedJsonBodyMiddleware({
      defaultMaxBytes: 4,
      pathLimits: [{ match: /\/rpc\//, maxBytes: 32 }]
    })(ctx as never, next);

    expect(ctx.set).toHaveBeenCalledWith("boundedRequest", expect.any(Request));
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    "/api/v1/auth/sign-in",
    "/api/v1/media/upload/asset-1",
    "/api/v1/exports/export-1/download",
    "/api/v1/stripe/webhook",
    "/api/v1/_logs/ingest",
    "/api/v1/health/ready"
  ])("anchors excluded route %s to the configured API base path", (pathname) => {
    const pattern = buildApiBodyLimitExclusionPattern("/api/v1/");

    expect(pattern.test(pathname)).toBe(true);
  });

  it.each([
    "/tenant/api/v1/stripe/webhook",
    "/api/v1/rpc/stripe/webhook",
    "/api/v1/authentic/request",
    "/api/v1/media-library/upload",
    "/api/v2/health/ready"
  ])("does not exclude substring lookalike %s", (pathname) => {
    const pattern = buildApiBodyLimitExclusionPattern("/api/v1/");

    expect(pattern.test(pathname)).toBe(false);
  });

  it("supports API routes mounted at the origin root", () => {
    expect(buildApiBodyLimitExclusionPattern("/").test("/health/live")).toBe(true);
  });
});
