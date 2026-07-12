import Redis from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { cacheDelete, cacheGet, cacheInvalidateTag, cacheKey, cacheSet, cacheWrap } from "#@/cache";
import { closeRedis } from "#@/redis";

const redisUrl = process.env.REDIS_URL;
const describeRedis = redisUrl ? describe : describe.skip;

function uniqueKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

describeRedis("cache with Redis", () => {
  let flushClient: Redis;

  beforeAll(() => {
    flushClient = new Redis(redisUrl!);
  });

  beforeEach(async () => {
    await flushClient.flushdb();
  });

  afterAll(async () => {
    await closeRedis();
    await flushClient.quit();
  });

  it("stores and retrieves values through Redis", async () => {
    const key = uniqueKey("redis-set-get");
    await cacheSet(key, { ok: true }, { namespace: "redis-ns" });

    await expect(cacheGet(key, { namespace: "redis-ns" })).resolves.toEqual({ ok: true });

    const fullKey = cacheKey(key, "redis-ns");
    const raw = await flushClient.get(fullKey);
    expect(raw).toContain('"ok":true');
  });

  it("deletes Redis entries", async () => {
    const key = uniqueKey("redis-delete");
    await cacheSet(key, "remove-me");
    await cacheDelete(key);

    await expect(cacheGet(key)).resolves.toBeNull();
  });

  it("wraps loaders with Redis-backed caching", async () => {
    const key = uniqueKey("redis-wrap");
    const loader = vi.fn(async () => "redis-computed");

    const first = await cacheWrap(key, loader);
    const second = await cacheWrap(key, loader);

    expect(first).toBe("redis-computed");
    expect(second).toBe("redis-computed");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("invalidates tagged Redis entries and returns the cleared count", async () => {
    const first = uniqueKey("tagged-one");
    const second = uniqueKey("tagged-two");
    const tag = `articles:${crypto.randomUUID()}`;

    await cacheSet(first, "a", { tags: [tag] });
    await cacheSet(second, "b", { tags: [tag] });

    const cleared = await cacheInvalidateTag(tag);

    expect(cleared).toBe(1);
    await expect(cacheGet(first)).resolves.toBeNull();
    await expect(cacheGet(second)).resolves.toBeNull();
  });

  it("bumps the tag version when invalidating an unused tag", async () => {
    const cleared = await cacheInvalidateTag(`missing-tag:${crypto.randomUUID()}`);
    expect(cleared).toBe(1);
  });
});
