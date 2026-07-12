import { describe, expect, it, vi } from "vite-plus/test";

import { checkRateLimit } from "#@/rate-limit";

vi.mock("#@/redis", () => {
  return {
    getRedis: vi.fn(() => {
      throw new Error("redis unavailable");
    })
  };
});

describe("checkRateLimit", () => {
  it("allows requests under the limit using the memory fallback", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const first = await checkRateLimit(key, 2, 60);
    const second = await checkRateLimit(key, 2, 60);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
  });

  it("blocks requests once the limit is exceeded", async () => {
    const key = `test:${crypto.randomUUID()}`;
    await checkRateLimit(key, 1, 60);
    const blocked = await checkRateLimit(key, 1, 60);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails closed when Redis is unavailable and failureMode is failClosed", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const result = await checkRateLimit(key, 5, 60, { failureMode: "failClosed" });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});
