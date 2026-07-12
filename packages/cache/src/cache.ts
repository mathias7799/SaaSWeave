import { ENV_SERVER } from "@saasweave/env/server/env";
import { createLogger } from "@saasweave/logger/server";

import { connectRedis, getRedis } from "#@/redis";
import { type SecurityFailureMode } from "#@/security-policy";

const log = createLogger({ operation: "server__cache" });

const MAX_MEMORY_CACHE_ENTRIES = 1_000;
const MAX_MEMORY_CACHE_BYTES = 8 * 1_024 * 1_024;
const MAX_TAG_CARDINALITY = 10_000;
const TAG_UNLINK_CHUNK_SIZE = 250;

type CacheEntry<T> = {
  approximateBytes: number;
  expiresAt: number;
  tags: string[];
  value: T;
};

type CacheEnvelope<T> = {
  storedAt: string;
  tagVersions: Record<string, number>;
  value: T;
};

export type CacheFailureMode = SecurityFailureMode;

export type CacheSetOptions = {
  failureMode?: CacheFailureMode;
  namespace?: string;
  tags?: string[];
  ttlSeconds?: number;
};

export type CacheWrapOptions = CacheSetOptions;

const memoryCache = new Map<string, CacheEntry<unknown>>();
const memoryTagVersions = new Map<string, number>();
const inFlight = new Map<string, Promise<unknown>>();

function ttlMs(ttlSeconds = ENV_SERVER.CACHE_DEFAULT_TTL_SECONDS): number {
  return Math.max(1, ttlSeconds) * 1_000;
}

function normalizePart(part: string): string {
  return part
    .trim()
    .replaceAll(/[^a-zA-Z0-9:_-]/g, ":")
    .replaceAll(/:{2,}/g, ":")
    .replace(/^:+|:+$/g, "");
}

export function cacheKey(key: string, namespace = "app"): string {
  return [ENV_SERVER.CACHE_PREFIX, normalizePart(namespace), normalizePart(key)]
    .filter(Boolean)
    .join(":");
}

function tagVersionKey(tag: string): string {
  return cacheKey(normalizePart(tag), "tag-version");
}

function approximateBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return 256;
  }
}

function resolveFailureMode(options: CacheSetOptions): CacheFailureMode {
  return options.failureMode ?? "failOpen";
}

function memoryBytesUsed(): number {
  let total = 0;
  for (const entry of memoryCache.values()) {
    total += entry.approximateBytes;
  }
  return total;
}

function trimMemoryCache(): void {
  while (
    memoryCache.size > MAX_MEMORY_CACHE_ENTRIES ||
    memoryBytesUsed() > MAX_MEMORY_CACHE_BYTES
  ) {
    const oldest = memoryCache.keys().next();
    if (oldest.done) break;
    memoryCache.delete(oldest.value);
  }
}

function getMemoryTagVersion(tag: string): number {
  return memoryTagVersions.get(tag) ?? 0;
}

function bumpMemoryTagVersion(tag: string): number {
  const next = getMemoryTagVersion(tag) + 1;
  memoryTagVersions.set(tag, next);
  return next;
}

function invalidateMemoryTag(tag: string): number {
  bumpMemoryTagVersion(tag);
  let removed = 0;
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.tags.includes(tag)) {
      memoryCache.delete(key);
      removed += 1;
    }
  }
  trimMemoryCache();
  return removed;
}

async function redisOrNull(failureMode: CacheFailureMode) {
  try {
    return await connectRedis(getRedis());
  } catch (error) {
    if (failureMode === "failClosed") {
      log.warn("Redis cache unavailable; failing closed", {
        error,
        event: "redis_cache_unavailable"
      });
      return null;
    }

    log.warn("Redis cache unavailable; using process memory fallback", {
      error,
      event: "redis_cache_unavailable"
    });
    return null;
  }
}

async function resolveTagVersions(
  tags: string[],
  redis: NonNullable<Awaited<ReturnType<typeof redisOrNull>>>
): Promise<Record<string, number>> {
  const versions: Record<string, number> = {};
  for (const tag of tags) {
    const key = tagVersionKey(tag);
    const current = await redis.get(key);
    versions[tag] = current ? Number(current) : 0;
  }
  return versions;
}

function isMemoryEntryValid(
  entry: CacheEntry<unknown> & { tagVersions?: Record<string, number> }
): boolean {
  for (const tag of entry.tags) {
    const stored = entry.tagVersions?.[tag] ?? 0;
    if (stored !== getMemoryTagVersion(tag)) {
      return false;
    }
  }
  return true;
}

function readMemory<T>(fullKey: string): T | null {
  const memory = memoryCache.get(fullKey) as
    | (CacheEntry<T> & {
        tagVersions?: Record<string, number>;
      })
    | undefined;
  if (!memory) return null;
  if (memory.expiresAt <= Date.now()) {
    memoryCache.delete(fullKey);
    return null;
  }
  if (!isMemoryEntryValid(memory)) {
    memoryCache.delete(fullKey);
    return null;
  }

  memoryCache.delete(fullKey);
  memoryCache.set(fullKey, memory);
  return memory.value;
}

function writeMemory<T>(
  fullKey: string,
  value: T,
  ttlSeconds: number,
  tags: string[],
  tagVersions: Record<string, number>
): void {
  const entry: CacheEntry<T> & { tagVersions?: Record<string, number> } = {
    approximateBytes: approximateBytes(value),
    expiresAt: Date.now() + ttlMs(ttlSeconds),
    tags,
    tagVersions,
    value
  };
  memoryCache.set(fullKey, entry);
  trimMemoryCache();
}

export async function cacheGet<T>(key: string, options: CacheSetOptions = {}): Promise<T | null> {
  const fullKey = cacheKey(key, options.namespace);
  const failureMode = resolveFailureMode(options);
  const redis = await redisOrNull(failureMode);

  if (redis) {
    try {
      const raw = await redis.get(fullKey);
      if (!raw) return null;
      const envelope = JSON.parse(raw) as CacheEnvelope<T>;
      const tagNames = Object.keys(envelope.tagVersions ?? {});
      if (tagNames.length > 0) {
        const versions = await resolveTagVersions(tagNames, redis);
        for (const tag of tagNames) {
          if ((envelope.tagVersions[tag] ?? 0) < (versions[tag] ?? 0)) {
            return null;
          }
        }
      }
      return envelope.value;
    } catch (error) {
      if (failureMode === "failClosed") {
        log.warn("Redis cache operation failed; failing closed", {
          error,
          event: "redis_cache_operation_failed"
        });
        return null;
      }

      log.warn("Redis cache operation failed; falling back to memory", {
        error,
        event: "redis_cache_operation_failed"
      });
    }
  }

  if (failureMode === "failClosed") {
    return null;
  }

  return readMemory<T>(fullKey);
}

export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheSetOptions = {}
): Promise<T> {
  const fullKey = cacheKey(key, options.namespace);
  const ttlSeconds = options.ttlSeconds ?? ENV_SERVER.CACHE_DEFAULT_TTL_SECONDS;
  const failureMode = resolveFailureMode(options);
  const redis = await redisOrNull(failureMode);
  const tags = options.tags ?? [];

  if (redis) {
    try {
      const tagVersions = tags.length > 0 ? await resolveTagVersions(tags, redis) : {};
      const envelope: CacheEnvelope<T> = {
        storedAt: new Date().toISOString(),
        tagVersions,
        value
      };
      await redis.set(fullKey, JSON.stringify(envelope), "EX", ttlSeconds);
      return value;
    } catch (error) {
      if (failureMode === "failClosed") {
        log.warn("Redis cache operation failed; failing closed", {
          error,
          event: "redis_cache_operation_failed"
        });
        return value;
      }

      log.warn("Redis cache operation failed; falling back to memory", {
        error,
        event: "redis_cache_operation_failed"
      });
    }
  }

  if (failureMode === "failClosed") {
    return value;
  }

  const tagVersions = Object.fromEntries(tags.map((tag) => [tag, getMemoryTagVersion(tag)]));
  writeMemory(fullKey, value, ttlSeconds, tags, tagVersions);
  return value;
}

export async function cacheDelete(key: string, options: CacheSetOptions = {}): Promise<void> {
  const fullKey = cacheKey(key, options.namespace);
  const failureMode = resolveFailureMode(options);
  const redis = await redisOrNull(failureMode);

  if (redis) {
    try {
      await redis.del(fullKey);
      return;
    } catch (error) {
      if (failureMode === "failClosed") {
        log.warn("Redis cache operation failed; failing closed", {
          error,
          event: "redis_cache_operation_failed"
        });
        return;
      }

      log.warn("Redis cache operation failed; falling back to memory", {
        error,
        event: "redis_cache_operation_failed"
      });
    }
  }

  if (failureMode === "failClosed") {
    return;
  }

  memoryCache.delete(fullKey);
}

export async function cacheInvalidateTag(
  tag: string,
  options: Pick<CacheSetOptions, "failureMode"> = {}
): Promise<number> {
  const failureMode = resolveFailureMode(options);
  const redis = await redisOrNull(failureMode);
  const versionKey = tagVersionKey(tag);

  if (redis) {
    try {
      const nextVersion = await redis.incr(versionKey);
      if (nextVersion > MAX_TAG_CARDINALITY) {
        await redis.set(versionKey, "1");
      }
      await redis.expire(versionKey, ENV_SERVER.CACHE_DEFAULT_TTL_SECONDS, "GT");
      return 1;
    } catch (error) {
      if (failureMode === "failClosed") {
        log.warn("Redis cache operation failed; failing closed", {
          error,
          event: "redis_cache_operation_failed"
        });
        return 0;
      }

      log.warn("Redis cache operation failed; falling back to memory", {
        error,
        event: "redis_cache_operation_failed"
      });
    }
  }

  if (failureMode === "failClosed") {
    return 0;
  }

  return invalidateMemoryTag(tag);
}

export async function cacheUnlinkKeys(keys: string[]): Promise<number> {
  const redis = await redisOrNull("failOpen");
  if (!redis || keys.length === 0) return 0;

  let removed = 0;
  for (let index = 0; index < keys.length; index += TAG_UNLINK_CHUNK_SIZE) {
    const chunk = keys.slice(index, index + TAG_UNLINK_CHUNK_SIZE);
    removed += await redis.unlink(...chunk);
  }
  return removed;
}

export function getMemoryCacheStats(): { bytes: number; entries: number } {
  return { bytes: memoryBytesUsed(), entries: memoryCache.size };
}

export async function cacheWrap<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheWrapOptions = {}
): Promise<T> {
  const fullKey = cacheKey(key, options.namespace);
  const cached = await cacheGet<T>(key, options);
  if (cached !== null) return cached;

  const existing = inFlight.get(fullKey) as Promise<T> | undefined;
  if (existing) return existing;

  const pending = loader()
    .then((value) => cacheSet(key, value, options))
    .finally(() => {
      inFlight.delete(fullKey);
    });

  inFlight.set(fullKey, pending);
  return pending;
}
