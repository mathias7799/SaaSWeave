# @saasweave/core

Shared domain contracts: feature catalog, webhook types, media asset helpers, and asset utilities.

## Feature catalog

`DEFAULT_FEATURES` seeds the `feature_flag` table with **shipped** capabilities only. Admin toggles live flags at `/admin/features`.

| Key             | Surface                         | Plans             |
| --------------- | ------------------------------- | ----------------- |
| `api_keys`      | `/app/api-keys`                 | starter+          |
| `webhooks`      | `/app/webhooks`                 | growth+           |
| `ai_assistant`  | `/app/ai-usage` (usage metrics) | starter+          |
| `sso`           | Settings SSO panel              | scale, enterprise |
| `audit_logs`    | `/app/audit`                    | scale+            |
| `usage_billing` | `console.recordUsage`           | growth+           |

`PLANNED_FEATURES` lists roadmap items (TODO, not in DB, not toggleable): `batch_jobs`, `custom_models`, `shared_workspaces`, `invoicing`.

## Webhooks

- `WEBHOOK_EVENTS` — `member.added`, `usage.recorded`, `api_key.*`, etc.
- `buildWebhookPayload()` — canonical outbound payload shape

## Media

- `buildMediaAssetKey()` — storage key convention
- `resolveMediaPublicUrl()` — public URL from key + base

## Key exports

```
@saasweave/core/features
@saasweave/core/webhooks
@saasweave/core/media-asset
@saasweave/core/assets
```

## Environment variables

None directly — consumed by api/db/jobs.

## Tests

```bash
pnpm --filter @saasweave/core test:unit
```
