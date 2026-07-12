# @saasweave/app

Worker-safe application services shared by the API (inline fallback) and BullMQ processors in `@saasweave/jobs`.

## Modules

| Subpath                       | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `billing/plan-catalog`        | Cached plan catalog reads, `planName` / `resolvePlanEntry`         |
| `billing/compute-current-mrr` | MRR snapshot math for admin analytics and cron                     |
| `stripe/webhook-apply`        | Idempotent Stripe event application (DB side effects only)         |
| `stripe/webhook-process`      | Per-customer ordering guard + queued payload parsing               |
| `data-export/*`               | Workspace export bundle build, storage upload, processing          |
| `batch-jobs/process`          | Batch item iteration and status updates                            |
| `storage/*`                   | MinIO/files-sdk client, media asset persistence, lifecycle cleanup |

## Boundaries

- **No** oRPC routers, **no** BullMQ worker registration, **no** queue dispatch imports (avoids cycles with `jobs`).
- Notification/email side effects after exports or Stripe subscriptions are orchestrated in `@saasweave/jobs`.

## Related

- [packages/jobs](../jobs/README.md) — queue processors call into this package
- [packages/api](../api/README.md) — HTTP transport and dispatch
- [docs/PACKAGE-DEPENDENCY-GRAPH.md](../../docs/PACKAGE-DEPENDENCY-GRAPH.md)
