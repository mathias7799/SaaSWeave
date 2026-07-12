# @saasweave/server

Node.js Hono server: oRPC API, Better Auth handler, Stripe webhooks, and media upload routes.

## Always on

- oRPC + OpenAPI (`/server/rpc`, `/server/docs` when enabled)
- Better Auth at `/server/auth/*`
- Health endpoints (`/health/live`, `/health/ready`)
- Maintenance mode middleware
- Auth rate limiting
- `GET /auth/providers` — public OAuth availability flags
- Media routes at `/media/*` (local disk or MinIO presigned)

## Optional / env-gated

| Feature                       | Enabled when                                  |
| ----------------------------- | --------------------------------------------- |
| OpenAPI Scalar docs           | `ENABLE_OPEN_API_DOCS=true`                   |
| Redis-backed rate limit cache | `REDIS_URL`                                   |
| MinIO presigned uploads       | All `MINIO_*` credentials set                 |
| Local disk uploads            | MinIO unset; uses `MEDIA_UPLOAD_DIR`          |
| Stripe webhooks               | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` |
| OAuth providers               | `GOOGLE_*` / `GITHUB_*`                       |
| Platform admin emails         | `PLATFORM_ADMIN_EMAILS`                       |

Stripe webhook request bodies are capped at 1 MiB before signature verification. The server
enforces the same limit for requests with `Content-Length` and for chunked request streams.

## Key modules

```
src/index.ts              # Hono app, route mounting
src/middleware/platform.ts  # maintenance, rate limits
src/routes/media.ts       # signed upload + serve
```

Route order matters: specific routes like `/auth/providers` must be registered **before** the `/auth/*` catch-all.

## Environment variables

See [packages/env/README.md](../../packages/env/README.md) for the full server schema (`ENV_SERVER`).

## Development

```bash
pnpm --filter @saasweave/server dev
```

Default: http://localhost:5000/server

## Docker

Built from `apps/server/Dockerfile`. Migrator target runs `db:migrate` before the server starts in Compose.

## Related

- [packages/api](../../packages/api/README.md) — router definitions
- [packages/auth](../../packages/auth/README.md) — Better Auth instance
