import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("#@/redis", () => {
  return {
    connectRedis: vi.fn(async () => null),
    getRedis: vi.fn(() => null)
  };
});

const { cacheGet, cacheInvalidateTag, cacheSet, getMemoryCacheStats } = await import("#@/cache");

describe("cache cardinality and scoped invalidation", () => {
  beforeEach(async () => {
    await cacheInvalidateTag(`reset:${crypto.randomUUID()}`);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("bounds memory cache entry count", async () => {
    for (let index = 0; index < 1_200; index += 1) {
      await cacheSet(`entry-${index}`, { index });
    }

    const stats = getMemoryCacheStats();
    expect(stats.entries).toBeLessThanOrEqual(1_000);
  });

  it("does not evict unrelated tags when invalidating one tenant tag", async () => {
    const tenantA = `tenant-a:${crypto.randomUUID()}`;
    const tenantB = `tenant-b:${crypto.randomUUID()}`;

    await cacheSet("value-a", "A", { tags: [tenantA] });
    await cacheSet("value-b", "B", { tags: [tenantB] });

    await cacheInvalidateTag(tenantA);

    await expect(cacheGet("value-a", { tags: [tenantA] })).resolves.toBeNull();
    await expect(cacheGet("value-b", { tags: [tenantB] })).resolves.toBe("B");
  });
});
