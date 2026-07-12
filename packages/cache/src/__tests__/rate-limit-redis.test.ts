import type Redis from "ioredis";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const connectRedis = vi.fn<() => Promise<Redis | null>>();
const getRedis = vi.fn<() => Redis | null>();

vi.mock("#@/redis", () => {
  return { connectRedis, getRedis };
});

const { checkRateLimit } = await import("#@/rate-limit");

function redisWithEval(result: [number, number] | Error): {
  evalSpy: ReturnType<typeof vi.fn>;
  redis: Redis;
} {
  const evalSpy = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return {
    evalSpy,
    redis: {
      eval: evalSpy,
      status: "ready"
    } as unknown as Redis
  };
}

describe("Redis-backed rate limiting", () => {
  beforeEach(() => {
    connectRedis.mockReset();
    getRedis.mockReset();
  });

  it("returns remaining capacity from the atomic Redis result", async () => {
    const { evalSpy, redis } = redisWithEval([2, 30_000]);
    getRedis.mockReturnValue(redis);
    connectRedis.mockResolvedValue(redis);

    await expect(checkRateLimit("auth:user", 5, 60)).resolves.toEqual({
      allowed: true,
      remaining: 3,
      retryAfterSeconds: 0
    });
    expect(evalSpy).toHaveBeenCalledWith(expect.any(String), 1, "ratelimit:auth:user", 60_000);
  });

  it("blocks over-limit Redis results using the reported TTL", async () => {
    const { redis } = redisWithEval([6, 2_250]);
    getRedis.mockReturnValue(redis);
    connectRedis.mockResolvedValue(redis);

    await expect(checkRateLimit("logs:ip", 5, 60)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 3
    });
  });

  it("fails closed when Redis eval throws", async () => {
    const { redis } = redisWithEval(new Error("eval unavailable"));
    getRedis.mockReturnValue(redis);
    connectRedis.mockResolvedValue(redis);

    await expect(
      checkRateLimit("export:user", 5, 60, { failureMode: "failClosed" })
    ).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60
    });
  });

  it("falls back to a bounded process bucket when Redis eval throws in fail-open mode", async () => {
    const { redis } = redisWithEval(new Error("eval unavailable"));
    getRedis.mockReturnValue(redis);
    connectRedis.mockResolvedValue(redis);
    const key = `public:${crypto.randomUUID()}`;

    await expect(checkRateLimit(key, 1, 60)).resolves.toMatchObject({ allowed: true });
    await expect(checkRateLimit(key, 1, 60)).resolves.toMatchObject({ allowed: false });
  });
});
