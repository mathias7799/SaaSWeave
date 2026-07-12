# @saasweave/worker

Background job **process host** using BullMQ. Registers processors from `@saasweave/jobs`; contains no domain logic.

## Responsibilities

| Concern                                             | Owner             |
| --------------------------------------------------- | ----------------- |
| Worker startup / shutdown, SIGINT/SIGTERM           | `apps/worker`     |
| Readiness HTTP (`WORKER_HEALTH_PORT`)               | `apps/worker`     |
| Repeatable schedule registration on boot            | `apps/worker`     |
| BullMQ processors (stripe, export, batch, email, …) | `@saasweave/jobs` |
| Stripe apply, export build, batch iteration         | `@saasweave/app`  |

## Queues processed

All queues from `@saasweave/jobs/worker` → `createAllWorkers()`:

`email`, `notifications`, `stripe`, `webhooks`, `data-export`, `batch-jobs`, `schedules`

Without Redis, the server falls back to inline delivery where possible (webhooks, email logging).

## Environment variables

Same as server for DB, Redis, mail, Stripe, and MinIO. See [packages/env/README.md](../../packages/env/README.md).

| Variable             | Default     | Notes                          |
| -------------------- | ----------- | ------------------------------ |
| `WORKER_CONCURRENCY` | `5`         | Parallel jobs per queue worker |
| `QUEUE_PREFIX`       | `saasweave` | Redis key namespace            |
| `WORKER_HEALTH_PORT` | `5001`      | Readiness probe port           |

## Development

```bash
pnpm --filter @saasweave/worker dev
```

Requires Redis (`REDIS_URL`) and migrated database.

## Docker

`worker` service in `docker-compose.yaml` starts after `migrate`, `redis`, and `minio-init`.

## Related

- [packages/jobs](../../packages/jobs/README.md) — queue definitions and processors
- [docs/PACKAGE-DEPENDENCY-GRAPH.md](../../docs/PACKAGE-DEPENDENCY-GRAPH.md)
