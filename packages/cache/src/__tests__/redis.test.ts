import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const redisUrl = process.env.REDIS_URL;

describe("redis lifecycle", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    if (redisUrl) {
      const { closeRedis } = await import("#@/redis");
      await closeRedis();
    }
  });

  it("prefers the live process env over the validated server default", async () => {
    vi.stubEnv("REDIS_URL", "redis://runtime:6379/9");

    const { resolveRedisUrl } = await import("#@/redis");

    expect(resolveRedisUrl()).toBe("redis://runtime:6379/9");
  });

  it("reports Redis as enabled when REDIS_URL is set", async () => {
    if (!redisUrl) return;

    const { isRedisEnabled } = await import("#@/redis");

    expect(isRedisEnabled()).toBe(true);
  });

  it("returns null from connectRedis when the client is null", async () => {
    const { connectRedis } = await import("#@/redis");

    await expect(connectRedis(null)).resolves.toBeNull();
  });

  it("reuses the shared Redis singleton from getRedis", async () => {
    if (!redisUrl) return;

    const { getRedis } = await import("#@/redis");
    const first = getRedis();
    const second = getRedis();

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it("connects a lazy client and reports healthy status", async () => {
    if (!redisUrl) return;

    const { checkRedisReady, closeRedis, connectRedis, getRedis } = await import("#@/redis");
    const client = getRedis();

    expect(client).not.toBeNull();
    expect(client?.status).not.toBe("ready");

    const connected = await connectRedis(client);
    expect(connected).toBe(client);
    await expect(connected?.ping()).resolves.toBe("PONG");

    const health = await checkRedisReady();
    expect(health).toEqual({
      configured: true,
      status: "healthy",
      url: expect.stringContaining("localhost:6379") as string
    });

    await closeRedis();
  });

  it("redacts credentials from redis urls", async () => {
    const { redactRedisUrl } = await import("#@/redis");

    expect(redactRedisUrl("redis://secret-user:secret-pass@localhost:6379/1")).not.toContain(
      "secret-pass"
    );
    expect(redactRedisUrl("redis://secret-user:secret-pass@localhost:6379/1")).not.toContain(
      "secret-user"
    );
  });

  it("closes the shared connection and allows a new singleton", async () => {
    if (!redisUrl) return;

    const { closeRedis, getRedis } = await import("#@/redis");
    const first = getRedis();

    await closeRedis();

    const second = getRedis();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);

    await closeRedis();
  });

  it("logs redis connection errors without crashing", async () => {
    if (!redisUrl) return;

    const { getRedis } = await import("#@/redis");
    const client = getRedis();

    expect(() => {
      client?.emit("error", new Error("synthetic connection error"));
    }).not.toThrow();
  });

  it("returns the ready client without reconnecting", async () => {
    if (!redisUrl) return;

    const { connectRedis, getRedis } = await import("#@/redis");
    const client = getRedis();
    const ready = await connectRedis(client);
    const again = await connectRedis(ready);

    expect(again).toBe(ready);
    expect(again?.status).toBe("ready");
  });
});
