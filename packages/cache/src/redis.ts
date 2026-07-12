import Redis, { type RedisOptions } from "ioredis";

import { ENV_SERVER } from "@saasweave/env/server/env";
import { createLogger } from "@saasweave/logger/server";
import { redisErrorsTotal } from "@saasweave/observability";

const log = createLogger({ operation: "server__redis" });

type RedisHealth = {
  configured: boolean;
  status: "healthy" | "unhealthy";
  url?: string;
};

let sharedRedis: Redis | null = null;

/** Prefer live process env so tests and CI can point at isolated Redis databases. */
export function resolveRedisUrl(): string | undefined {
  const raw = process.env.REDIS_URL;
  if (raw === "") return undefined;
  if (raw) return raw;
  return ENV_SERVER.REDIS_URL;
}

export function redactRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "redacted";
    if (parsed.username) parsed.username = "redacted";
    return parsed.toString();
  } catch {
    return "redacted";
  }
}

export function isRedisEnabled(): boolean {
  return Boolean(resolveRedisUrl());
}

function attachRedisErrorHandler(client: Redis): void {
  // ioredis emits connection errors as events; without a listener Node treats them as fatal.
  client.on("error", (error) => {
    redisErrorsTotal.inc();
    log.warn("Redis connection error", {
      error,
      event: "redis_connection_error"
    });
  });
}

export function createRedisConnection(name: string, options: RedisOptions = {}): Redis | null {
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) return null;

  const client = new Redis(redisUrl, {
    connectionName: `${ENV_SERVER.CACHE_PREFIX}:${name}`,
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    ...options
  });
  attachRedisErrorHandler(client);
  return client;
}

export async function connectRedis(client: Redis | null = getRedis()): Promise<Redis | null> {
  if (!client) return null;

  if (client.status === "ready") return client;
  if (client.status === "wait" || client.status === "end") {
    await client.connect();
  }

  return client;
}

export function getRedis(): Redis | null {
  if (!isRedisEnabled()) return null;

  sharedRedis ??= createRedisConnection("shared");
  return sharedRedis;
}

export async function checkRedisReady(): Promise<RedisHealth> {
  const client = getRedis();
  const redisUrl = resolveRedisUrl();
  if (!client || !redisUrl) {
    return { configured: false, status: "healthy" };
  }

  await connectRedis(client);
  await client.ping();

  return {
    configured: true,
    status: "healthy",
    url: redactRedisUrl(redisUrl)
  };
}

export async function closeRedis(): Promise<void> {
  const client = sharedRedis;
  sharedRedis = null;
  if (!client) return;
  await client.quit();
}
