# @saasweave/jobs

BullMQ queues, job dispatch, webhook delivery, repeatable schedules, and **domain processors**.

## Queues

| Name            | Purpose                   |
| --------------- | ------------------------- |
| `email`         | Template email send       |
| `notifications` | In-app notifications      |
| `stripe`        | Stripe webhook processing |
| `webhooks`      | Outbound HTTP webhooks    |
| `data-export`   | Workspace export jobs     |
| `batch-jobs`    | Demo / batch workloads    |
| `schedules`     | Cron maintenance jobs     |

## Processors

Processors live in this package (`domain-workers.ts`, `schedule-worker.ts`, `worker.ts`). They call `@saasweave/app` for domain logic and handle queue-specific orchestration (post-export notifications, subscription emails).

`apps/worker` only composes `createAllWorkers()` from `@saasweave/jobs/worker` plus signal/readiness lifecycle.

## Dispatch behavior

| Function                | Without Redis | With Redis |
| ----------------------- | ------------- | ---------- |
| `dispatchTemplateEmail` | Console/log   | Queued     |
| `dispatchNotification`  | Inline        | Queued     |
| `dispatchOrgWebhook`    | Inline HTTP   | Queued     |
| `dispatchStripeWebhook` | Inline        | Queued     |

## Schedules

- `registerRepeatableSchedules()` — invitation expiry, MRR snapshot, storage cleanup, data retention
- `expireStaleInvitations()` — cancels pending invites older than 30 days

## Tests

```bash
pnpm --filter @saasweave/jobs test:unit
```

## Related

- [packages/app](../app/README.md) — worker-safe services invoked by processors
- [apps/worker](../../apps/worker/README.md) — process host
