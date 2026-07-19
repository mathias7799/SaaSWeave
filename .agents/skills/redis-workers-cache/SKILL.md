---
name: redis-workers-cache
description: Use for SaaSWeave tasks involving Redis, server-side caching, BullMQ background jobs, workers, queue health, or Docker/Coolify infrastructure for async processing. Apply when adding cached API reads, invalidation, async email/workflow jobs, worker processors, readiness checks, or Redis-related env vars.
---

# Redis Workers Cache

Redis is optional infrastructure for cache reads and required infrastructure for
queues and workers. Keep cache, queue, and worker code in the shared packages so
features opt in without coupling to one page or router.

The patterns for package boundaries, cache reads, queues, retention, and env
surfaces live in [Redis, queues, and caching](references/redis-cache-jobs.md).
Read that first, then apply the validation below.

## Validation

After changes, run the narrow package check first, then workspace validation:

```bash
vp check --fix
vp run -w fix
vp run build
vp run test:unit:run
vp run coverage:gate
```

For Docker or runtime changes, also run:

```bash
vp run ops:compose-validate
vp run docker:up:build
curl -fsS http://localhost:5000/server/health/ready
curl -fsS http://localhost:9100/health/ready
docker logs --tail 120 saasweave-worker
```

Keep worker port 9100 private; its metrics endpoint has no application
authentication. Server metrics require `METRICS_BEARER_TOKEN` when enabled.
