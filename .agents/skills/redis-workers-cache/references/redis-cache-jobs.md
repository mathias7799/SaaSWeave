# Redis, queues, and caching

Reference for Redis-backed caching, BullMQ queues, and worker processors in
SaaSWeave. The [redis-workers-cache skill](../SKILL.md) covers when to apply
this and how to validate a change; this file holds the durable patterns.

Redis is optional infrastructure for cache reads and required infrastructure for
queues and workers. Keep cache, queue, and worker code in the shared packages so
features can opt in without coupling to one page or router.

## Package boundaries

- Use `@saasweave/cache` for Redis connections, cache keys, TTL cache reads, tag invalidation, and Redis readiness.
- Use `@saasweave/jobs/queues` from API/server code that produces jobs.
- Use `@saasweave/jobs/worker` only from `apps/worker`; do not import worker processors into API routers.
- Put reusable DB/storage/provider workflows in `@saasweave/app`; this package must not import BullMQ dispatch or oRPC routers.
- Keep queue processors and schedule handlers in `packages/jobs/src/{worker,domain-workers,schedule-worker}.ts`. `apps/worker` only owns process lifecycle, readiness/metrics HTTP, signals, schedule registration, and composition.
- Keep feature processors idempotent. A retry must not double-charge, double-send a live provider request, or duplicate persisted side effects unless the operation is explicitly idempotent.

## Cache pattern

Use `cacheWrap(key, loader, { namespace, ttlSeconds, tags })` around real
database or provider reads that are safe to reuse briefly. Prefer short TTLs for
dashboard stats and explicit tag invalidation after writes.

Use stable keys made from tenant/workspace ids and filters, for example
`overview:${organizationId}:${range}`. Never cache data whose authorization
scope is unclear.

When Redis is unavailable, `@saasweave/cache` falls back to process memory for
cache reads. Readiness still reports Redis unhealthy when `REDIS_URL` is
configured and unreachable.

**Do not cache:** auth sessions, API key verification, export blobs, or raw
audit pages.

## Queue pattern

Create enqueue helpers in `packages/jobs/src/queues.ts`. Keep job payloads
JSON-serializable and version-tolerant. Store ids, not large objects.

Create core email/notification processors in `packages/jobs/src/worker.ts`,
domain processors in `domain-workers.ts`, and cron handlers in
`schedule-worker.ts`; compose them through `createAllWorkers()`. The worker app
owns lifecycle, signal handling, health/metrics HTTP, and connection cleanup.

Use stable, unique `jobId` values for deduplication. Keep payloads small and
reload authoritative state inside the processor. For long exports, keep
streaming and byte/row limits in `packages/app`; progress counters do not imply
resumability unless the artifact writer also resumes safely.

## Retention

Retention is a scheduled job, not ad hoc request cleanup. Add product-data
deletion queries in `packages/db`, storage deletion in `packages/app`, and
orchestration/metrics in `packages/jobs/src/retention/`. Respect legal holds and
dry-run configuration.

## Environment surfaces

When adding Redis/worker settings, update all env surfaces:

- `packages/env/src/server/env.ts`
- `.env.docker.example`
- `packages/env/.env.example`
- `docker-compose.yaml`
- `docker-compose.coolify.yaml`
- `packages/env/README.md` or the relevant operations runbook

Use `REDIS_URL`, `CACHE_PREFIX`, `CACHE_DEFAULT_TTL_SECONDS`, `QUEUE_PREFIX`, and
`WORKER_CONCURRENCY` before adding new knobs.

## Runtime hardening

Production Compose keeps server/web/worker containers read-only with dropped
capabilities, resource limits, and health checks. Keep worker port 9100 private;
its metrics endpoint has no application authentication. Server metrics require
`METRICS_BEARER_TOKEN` when enabled.
