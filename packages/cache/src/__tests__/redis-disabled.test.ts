import { describe, expect, it, vi } from "vite-plus/test";

vi.stubEnv("REDIS_URL", "");

vi.mock("@saasweave/env/server/env", () => {
  return {
    ENV_SERVER: {
      CACHE_DEFAULT_TTL_SECONDS: 300,
      CACHE_PREFIX: "saasweave",
      REDIS_URL: undefined
    }
  };
});

const { checkRedisReady, createRedisConnection, getRedis, isRedisEnabled } =
  await import("#@/redis");

describe("redis when disabled", () => {
  it("reports Redis as disabled", () => {
    expect(isRedisEnabled()).toBe(false);
  });

  it("returns null from createRedisConnection", () => {
    expect(createRedisConnection("disabled")).toBeNull();
  });

  it("returns null from getRedis", () => {
    expect(getRedis()).toBeNull();
  });

  it("returns unconfigured health", async () => {
    await expect(checkRedisReady()).resolves.toEqual({
      configured: false,
      status: "healthy"
    });
  });
});
