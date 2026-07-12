import { createLogger } from "@saasweave/logger/server";
import { rateLimitHitsTotal } from "@saasweave/observability";

import { connectRedis, getRedis } from "#@/redis";

const log = createLogger({ operation: "server__rate_limit" });

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitFailureMode = "failClosed" | "failOpen";

type CheckRateLimitOptions = {
  failureMode?: RateLimitFailureMode;
};

const RATE_LIMIT_UNAVAILABLE: RateLimitResult = {
  allowed: false,
  remaining: 0,
  retryAfterSeconds: 60
};

const RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
else
  local ttl = redis.call("PTTL", KEYS[1])
  if ttl < 0 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
end
return {count, redis.call("PTTL", KEYS[1])}
`;

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function recordRateLimitHit(key: string): void {
  rateLimitHitsTotal.inc({ scope: key.split(":", 1)[0] || "unknown" });
}

async function redisOrNull(failureMode: RateLimitFailureMode) {
  try {
    return await connectRedis(getRedis());
  } catch (error) {
    if (failureMode === "failClosed") {
      log.warn("Redis rate-limit unavailable; failing closed", {
        error,
        event: "redis_rate_limit_unavailable"
      });
      return null;
    }

    log.warn("Redis rate-limit unavailable; using process memory fallback", {
      error,
      event: "redis_rate_limit_unavailable"
    });
    return null;
  }
}

function checkMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    recordRateLimitHit(key);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSeconds: 0
  };
}

/**
 * Fixed-window rate limiter. Uses Redis when available, otherwise process memory.
 *
 * `failureMode: "failClosed"` rejects requests when Redis is configured but unavailable.
 * `failureMode: "failOpen"` (default) falls back to per-process memory limits.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  options: CheckRateLimitOptions = {}
): Promise<RateLimitResult> {
  const failureMode = options.failureMode ?? "failOpen";
  const windowMs = windowSeconds * 1000;
  const redis = await redisOrNull(failureMode);
  if (!redis) {
    if (failureMode === "failClosed") {
      return RATE_LIMIT_UNAVAILABLE;
    }
    return checkMemory(key, limit, windowMs);
  }

  const redisKey = `ratelimit:${key}`;
  try {
    const [count, ttl] = (await redis.eval(RATE_LIMIT_SCRIPT, 1, redisKey, windowMs)) as [
      number,
      number
    ];
    if (count > limit) {
      recordRateLimitHit(key);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000))
      };
    }
    return { allowed: true, remaining: limit - count, retryAfterSeconds: 0 };
  } catch (error) {
    if (failureMode === "failClosed") {
      log.warn("Redis rate-limit unavailable; failing closed", {
        error,
        event: "redis_rate_limit_unavailable"
      });
      return RATE_LIMIT_UNAVAILABLE;
    }

    log.warn("Redis rate-limit unavailable; using process memory fallback", {
      error,
      event: "redis_rate_limit_unavailable"
    });
    return checkMemory(key, limit, windowMs);
  }
}
