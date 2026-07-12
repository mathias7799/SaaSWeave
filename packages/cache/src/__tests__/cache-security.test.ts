import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      CACHE_DEFAULT_TTL_SECONDS: 300,
      CACHE_PREFIX: "test-cache"
    }
  };
});

const connectRedis = vi.fn();
const getRedis = vi.fn();

vi.mock("#@/redis", () => {
  return {
    connectRedis,
    getRedis
  };
});

const { cacheGet, cacheSet } = await import("#@/cache");

describe("cache security failure mode", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not fall back to memory when failureMode is failClosed", async () => {
    connectRedis.mockRejectedValue(new Error("redis unavailable"));
    getRedis.mockReturnValue({});

    const key = `secure:${crypto.randomUUID()}`;
    await cacheSet(key, "secret", { failureMode: "failClosed", namespace: "api-keys" });
    await expect(
      cacheGet(key, { failureMode: "failClosed", namespace: "api-keys" })
    ).resolves.toBeNull();
  });

  it("falls back to bounded memory for availability caches", async () => {
    connectRedis.mockRejectedValue(new Error("redis unavailable"));
    getRedis.mockReturnValue({});

    const key = `availability:${crypto.randomUUID()}`;
    await cacheSet(key, "value", { namespace: "dashboard" });
    await expect(cacheGet(key, { namespace: "dashboard" })).resolves.toBe("value");
  });
});
