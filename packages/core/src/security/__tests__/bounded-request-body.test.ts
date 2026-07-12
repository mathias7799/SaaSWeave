import { describe, expect, it } from "vite-plus/test";

import {
  assertContentLengthWithinLimit,
  BoundedBodyError,
  drainRequestBody,
  parseContentLength,
  readBoundedRequest,
  readBoundedRequestBody,
  readBoundedRequestBodyOrNull,
  readBoundedRequestOrNull,
  replaceRequestBody
} from "#@/security/bounded-request-body";

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

describe("parseContentLength", () => {
  it("returns null for missing, false, or invalid values", () => {
    expect(parseContentLength(undefined)).toBeNull();
    expect(parseContentLength(null)).toBeNull();
    expect(parseContentLength("")).toBeNull();
    expect(parseContentLength("false")).toBeNull();
    expect(parseContentLength("not-a-number")).toBeNull();
    expect(parseContentLength("-1")).toBeNull();
  });

  it("parses valid Content-Length values", () => {
    expect(parseContentLength("0")).toBe(0);
    expect(parseContentLength("42")).toBe(42);
  });
});

describe("BoundedBodyError", () => {
  it("uses HTTP 413 as the status code", () => {
    const error = new BoundedBodyError();
    expect(error.status).toBe(413);
  });
});

describe("assertContentLengthWithinLimit", () => {
  it("rejects oversized Content-Length before streaming", () => {
    expect(() => assertContentLengthWithinLimit(9, 8)).toThrow(BoundedBodyError);
    expect(() => assertContentLengthWithinLimit(8, 8)).not.toThrow();
    expect(() => assertContentLengthWithinLimit(null, 8)).not.toThrow();
  });
});

describe("readBoundedRequestBody", () => {
  it("reads bodies at the exact byte limit", async () => {
    const body = await readBoundedRequestBody({
      contentLength: 4,
      maxBytes: 4,
      stream: streamFromChunks([new Uint8Array([1, 2, 3, 4])])
    });

    expect(Array.from(body)).toEqual([1, 2, 3, 4]);
  });

  it("rejects chunked bodies that exceed the limit without buffering the remainder", async () => {
    const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];

    await expect(
      readBoundedRequestBody({
        maxBytes: 4,
        stream: streamFromChunks(chunks)
      })
    ).rejects.toBeInstanceOf(BoundedBodyError);

    const exact = await readBoundedRequestBody({
      maxBytes: 6,
      stream: streamFromChunks(chunks)
    });
    expect(exact.byteLength).toBe(6);
  });

  it("accepts absent Content-Length when the streamed body is within the limit", async () => {
    const body = await readBoundedRequestBody({
      maxBytes: 8,
      stream: streamFromChunks([new Uint8Array([9, 9])])
    });

    expect(body.byteLength).toBe(2);
  });

  it("combines multiple non-empty chunks and handles empty bodies", async () => {
    const body = await readBoundedRequestBody({
      maxBytes: 8,
      stream: streamFromChunks([new Uint8Array(0), new Uint8Array([1, 2]), new Uint8Array([3, 4])])
    });
    expect(Array.from(body)).toEqual([1, 2, 3, 4]);

    await expect(readBoundedRequestBody({ maxBytes: 8, stream: null })).resolves.toEqual(
      new Uint8Array(0)
    );
    await expect(
      readBoundedRequestBody({ maxBytes: 8, stream: streamFromChunks([]) })
    ).resolves.toEqual(new Uint8Array(0));
  });
});

describe("request body helpers", () => {
  it("reads Request bodies and returns null for an oversized request", async () => {
    const exact = new Request("https://example.test/input", {
      body: "test",
      headers: { "content-length": "4" },
      method: "POST"
    });
    await expect(readBoundedRequest(exact, 4)).resolves.toEqual(
      new Uint8Array([116, 101, 115, 116])
    );

    const oversized = new Request("https://example.test/input", {
      body: "large",
      headers: { "content-length": "5" },
      method: "POST"
    });
    await expect(readBoundedRequestOrNull(oversized, 4)).resolves.toBeNull();
  });

  it("drains streams without retaining bytes and tolerates stream failures", async () => {
    await expect(drainRequestBody(streamFromChunks([new Uint8Array([1, 2])]))).resolves.toBe(
      undefined
    );
    await expect(drainRequestBody(null)).resolves.toBe(undefined);

    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("read failed"));
      }
    });
    await expect(drainRequestBody(failing)).resolves.toBe(undefined);
  });

  it("replaces a consumed request body and updates Content-Length", async () => {
    const request = new Request("https://example.test/input", {
      body: "old",
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const replacement = replaceRequestBody(request, new Uint8Array([1, 2, 3]));

    expect(replacement.headers.get("content-length")).toBe("3");
    expect(replacement.headers.get("content-type")).toBe("application/json");
    await expect(replacement.arrayBuffer()).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer);
  });
});

describe("readBoundedRequestBodyOrNull", () => {
  it("returns null only when the body exceeds the configured limit", async () => {
    await expect(
      readBoundedRequestBodyOrNull({ contentLength: 5, maxBytes: 4, stream: null })
    ).resolves.toBeNull();

    await expect(
      readBoundedRequestBodyOrNull({
        maxBytes: 4,
        stream: streamFromChunks([new Uint8Array([1, 2, 3, 4])])
      })
    ).resolves.toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});
