import type Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const connectRedis = vi.fn<() => Promise<Redis | null>>();
const getRedis = vi.fn<() => Redis | null>();

vi.mock("#@/redis", () => {
  return {
    connectRedis,
    getRedis
  };
});

const { cacheDelete, cacheGet, cacheInvalidateTag, cacheSet } = await import("#@/cache");

function uniqueKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

function createFailingRedis(): Redis {
  const error = new Error("redis operation failed");
  return {
    status: "ready",
    del: vi.fn(async () => {
      throw error;
    }),
    get: vi.fn(async () => {
      throw error;
    }),
    sadd: vi.fn(async () => {
      throw error;
    }),
    set: vi.fn(async () => {
      throw error;
    }),
    smembers: vi.fn(async () => {
      throw error;
    })
  } as unknown as Redis;
}

describe("cache redis operation fallback", () => {
  beforeEach(async () => {
    connectRedis.mockReset();
    getRedis.mockReset();
    connectRedis.mockResolvedValue(createFailingRedis());
    getRedis.mockReturnValue(createFailingRedis());
    await cacheInvalidateTag(`reset:${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await cacheInvalidateTag(`reset:${crypto.randomUUID()}`);
  });

  it("falls back to memory when connectRedis rejects", async () => {
    connectRedis.mockRejectedValueOnce(new Error("connect failed"));
    const key = uniqueKey("connect-fallback");

    await cacheSet(key, "memory-value");
    await expect(cacheGet(key)).resolves.toBe("memory-value");
  });

  it("falls back to memory when redis get fails", async () => {
    const key = uniqueKey("get-fallback");
    await cacheSet(key, "stored");

    await expect(cacheGet(key)).resolves.toBe("stored");
  });

  it("falls back to memory when redis set fails", async () => {
    const key = uniqueKey("set-fallback");
    await cacheSet(key, "stored");

    await expect(cacheGet(key)).resolves.toBe("stored");
  });

  it("falls back to memory when redis delete fails", async () => {
    const key = uniqueKey("delete-fallback");
    await cacheSet(key, "stored");
    await cacheDelete(key);

    await expect(cacheGet(key)).resolves.toBeNull();
  });

  it("falls back to memory tag invalidation when redis tag invalidation fails", async () => {
    const first = uniqueKey("tag-fallback-one");
    const second = uniqueKey("tag-fallback-two");
    const tag = "articles";
    await cacheSet(first, "a", { tags: [tag] });
    await cacheSet(second, "b", { tags: [tag] });

    const cleared = await cacheInvalidateTag(tag);

    expect(cleared).toBe(2);
    await expect(cacheGet(first)).resolves.toBeNull();
    await expect(cacheGet(second)).resolves.toBeNull();
  });
});
