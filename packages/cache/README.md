# @saasweave/cache

Redis-backed cache and rate limiting with explicit failure policies for security-sensitive state.

## Behavior

| Tier                | Examples                                             | Redis down in production                  |
| ------------------- | ---------------------------------------------------- | ----------------------------------------- |
| Availability caches | Dashboard reads, AI usage summaries                  | Bounded per-process memory fallback       |
| Security state      | Auth/export/log rate limits, API keys, IP allowlists | `failureMode: failClosed` when configured |

Use `resolveSecurityFailureMode()` for auth rate limits, export limits, API-key lookups, and IP allowlist caches. Security paths must not silently fall back to per-process memory across replicas when `REDIS_URL` is configured.

| Condition                             | Availability cache                 | Security cache / rate limits            |
| ------------------------------------- | ---------------------------------- | --------------------------------------- |
| `REDIS_URL` set and Redis healthy     | Shared Redis with tag invalidation | Distributed across replicas             |
| `REDIS_URL` set and Redis unavailable | Bounded memory fallback            | Fail closed (reject / cache miss to DB) |
| `REDIS_URL` unset                     | Bounded memory fallback            | Fail open (single-process only)         |

`checkRedisReady()` reports unhealthy when `REDIS_URL` is configured and unreachable, which makes `/health/ready` fail in production.

In **production**, env validation requires `REDIS_URL` unless `ALLOW_SINGLE_INSTANCE_FALLBACK=true` is set (single-instance escape hatch).

## Key exports

- `@saasweave/cache` — cache helpers (`cacheGet`, `cacheSet`, `cacheWrap`, tag invalidation, `failureMode`)
- `@saasweave/cache/rate-limit` — fixed-window rate limiter with `failureMode`
- `@saasweave/cache/redis` — connection helpers and readiness checks
- `resolveSecurityFailureMode()` — shared fail-closed policy helper

## Environment variables

Validated in `@saasweave/env` (`ENV_SERVER`):

| Variable                         | Default     | Notes                                                               |
| -------------------------------- | ----------- | ------------------------------------------------------------------- |
| `REDIS_URL`                      | unset       | Required in production unless `ALLOW_SINGLE_INSTANCE_FALLBACK=true` |
| `ALLOW_SINGLE_INSTANCE_FALLBACK` | `false`     | Single-instance production escape hatch                             |
| `CACHE_PREFIX`                   | `saasweave` | Redis key namespace prefix                                          |
| `CACHE_DEFAULT_TTL_SECONDS`      | `300`       | Default TTL for cache entries                                       |

## Tests

```bash
pnpm --filter @saasweave/cache test:unit
```

## Related

- [packages/jobs](../jobs/README.md) — shares Redis connection for BullMQ
- [packages/env](../env/README.md) — production Redis and mail validation
