import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("#@/redis", () => {
  return {
    connectRedis: vi.fn(async () => null),
    getRedis: vi.fn(() => null)
  };
});

const { cacheDelete, cacheGet, cacheInvalidateTag, cacheKey, cacheSet, cacheWrap } =
  await import("#@/cache");

function uniqueKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

describe("cache memory fallback", () => {
  beforeEach(async () => {
    await cacheInvalidateTag(`reset:${crypto.randomUUID()}`);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds namespaced keys with normalized parts", () => {
    expect(cacheKey("my key!", "ns space")).toBe("saasweave:ns:space:my:key");
    expect(cacheKey("  foo::bar  ", "app")).toBe("saasweave:app:foo:bar");
  });

  it("stores and retrieves values in memory", async () => {
    const key = uniqueKey("memory-set-get");
    await cacheSet(key, { count: 1 }, { namespace: "test-ns" });
    await expect(cacheGet(key, { namespace: "test-ns" })).resolves.toEqual({ count: 1 });
  });

  it("returns null for missing keys", async () => {
    await expect(cacheGet(uniqueKey("missing"))).resolves.toBeNull();
  });

  it("isolates values by namespace", async () => {
    const key = uniqueKey("namespace");
    await cacheSet(key, "alpha", { namespace: "one" });
    await cacheSet(key, "beta", { namespace: "two" });

    await expect(cacheGet(key, { namespace: "one" })).resolves.toBe("alpha");
    await expect(cacheGet(key, { namespace: "two" })).resolves.toBe("beta");
  });

  it("expires entries after the ttl elapses", async () => {
    vi.useFakeTimers();
    const key = uniqueKey("ttl");
    await cacheSet(key, "stale", { ttlSeconds: 1 });

    vi.advanceTimersByTime(1_001);

    await expect(cacheGet(key)).resolves.toBeNull();
  });

  it("deletes a cached entry", async () => {
    const key = uniqueKey("delete");
    await cacheSet(key, "gone");
    await cacheDelete(key);

    await expect(cacheGet(key)).resolves.toBeNull();
  });

  it("invalidates only entries for a tag in memory", async () => {
    const tagged = uniqueKey("tag-one");
    const untouched = uniqueKey("tag-two");
    await cacheSet(tagged, "a", { tags: ["tenant:a"] });
    await cacheSet(untouched, "b", { tags: ["tenant:b"] });

    const cleared = await cacheInvalidateTag("tenant:a");

    expect(cleared).toBeGreaterThanOrEqual(1);
    await expect(cacheGet(tagged, { tags: ["tenant:a"] })).resolves.toBeNull();
    await expect(cacheGet(untouched, { tags: ["tenant:b"] })).resolves.toBe("b");
  });

  it("computes once and serves cached values on subsequent cacheWrap calls", async () => {
    const key = uniqueKey("wrap");
    const loader = vi.fn(async () => "computed");

    const first = await cacheWrap(key, loader);
    const second = await cacheWrap(key, loader);

    expect(first).toBe("computed");
    expect(second).toBe("computed");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent cacheWrap loaders for the same key", async () => {
    const key = uniqueKey("wrap-inflight");
    let loads = 0;
    const loader = vi.fn(async () => {
      loads += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
      return `shared-${loads}`;
    });

    const [first, second] = await Promise.all([cacheWrap(key, loader), cacheWrap(key, loader)]);

    expect(first).toBe("shared-1");
    expect(second).toBe("shared-1");
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
