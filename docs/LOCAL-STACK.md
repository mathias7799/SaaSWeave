# Local full stack (Docker Compose)

Run every app and infrastructure service locally with one command.

## Quick start

```bash
cp .env.docker.example .env.docker
# Set BETTER_AUTH_SECRET (vp run auth:secret)
pnpm run docker:up:build
```

Services:

| Service    | URL                                   | Purpose                   |
| ---------- | ------------------------------------- | ------------------------- |
| Web        | http://localhost:3000                 | TanStack Start UI         |
| Server     | http://localhost:5000/server          | Hono API + auth           |
| PostgreSQL | localhost:5432                        | Primary database          |
| Redis      | localhost:6379                        | Cache + BullMQ            |
| MinIO      | http://localhost:9000 (console :9001) | S3-compatible uploads     |
| imgproxy   | http://localhost:8080                 | Avatar/image optimization |
| Worker     | (no HTTP port)                        | Background jobs           |

## What is enabled by default in Docker

| Capability                | Default in Compose     | Toggle                                                                                  |
| ------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| Auth (email/password)     | On                     | Always                                                                                  |
| OAuth (GitHub/Google)     | Off                    | Set `GOOGLE_*` / `GITHUB_*`                                                             |
| SSO / SAML                | On (feature flag)      | Console settings + scale/enterprise plan                                                |
| 2FA                       | On                     | User security page                                                                      |
| Redis cache + queues      | On                     | `REDIS_URL` (required in production; see escape hatch below)                            |
| BullMQ workers            | On                     | Requires Redis + worker service                                                         |
| Webhook delivery          | On                     | Requires Redis; inline without Redis                                                    |
| MinIO object storage      | On                     | `MINIO_*` vars (pre-filled)                                                             |
| Local disk media fallback | Off when MinIO set     | Clear `MINIO_ENDPOINT`                                                                  |
| imgproxy                  | On                     | `VITE_IMGPROXY_URL` on web                                                              |
| Stripe billing            | Off (sample mode)      | `STRIPE_SECRET_KEY`                                                                     |
| Transactional email       | Console log only       | `MAIL_PROVIDER=resend\|smtp`                                                            |
| OpenAPI docs              | Off in compose default | `ENABLE_OPEN_API_DOCS=true` in `.env.docker.example` for local exploration              |
| Invitation expiry cron    | On                     | `WORKER_SCHEDULE_INVITATION_CRON`                                                       |
| SAML test IdP             | Off                    | `docker compose --profile sso-test up sso-idp` — see [SSO-TESTING.md](./SSO-TESTING.md) |

## Environment file

Copy [`.env.docker.example`](../.env.docker.example) to `.env.docker`. All variables are documented there.

For native development (`vp run dev`), use [`packages/env/.env`](../packages/env/.env) from [`.env.example`](../packages/env/.env.example) instead.

**Production Redis:** when `NODE_ENV=production`, `REDIS_URL` is required so cache and rate limits are shared across replicas. For intentional single-instance production deploys only, set `ALLOW_SINGLE_INSTANCE_FALLBACK=true` (documented in [`.env.docker.example`](../.env.docker.example)).

## Database migrations

Migrations are **not** run when the server or worker boots. They run as an explicit one-shot step before those services start.

**Docker Compose:** the `migrate` service builds the server migrator image, waits for Postgres to be healthy, runs `vp run db:migrate`, and exits. `server` and `worker` depend on `migrate` with `condition: service_completed_successfully`, so they only start after migrations succeed.

**Local (native dev):**

```bash
pnpm --filter @saasweave/db migrate
# or from repo root:
pnpm run db:migrate
```

**Coolify / production deploy:** run the same migrate command as a **pre-deploy** (release) step before rolling out new server/worker containers — not on every replica boot. Example pre-deploy command inside the migrator/server image:

```bash
vp run db:migrate
```

Ensure `DATABASE_URL` (and other required env vars) are available to that step. Concurrent pre-deploy runs are safe: the migrator takes a Postgres session advisory lock (`pg_advisory_lock`) so only one process applies migrations at a time.

## Commands

```bash
pnpm run docker:up          # start (no rebuild)
pnpm run docker:up:build    # rebuild images and start
pnpm run docker:down        # stop and remove containers
```

Underlying:

```bash
pnpm dotenvx run -f .env.docker -- docker compose up --build
```

## Health checks

- Server: `GET /server/health/live` (liveness), `GET /server/health/ready` (readiness)
- Web: `GET /_api/health/live`
- Worker: `GET http://localhost:9100/health/ready` (Docker maps `WORKER_HEALTH_PORT`)
- Metrics: `GET /server/metrics`, worker `GET :9100/metrics`
- Auth providers: `GET /server/auth/providers`
- MinIO: `GET /minio/health/live`

Production operations (backups, retention, alerts): [PRODUCTION-OPERATIONS.md](./PRODUCTION-OPERATIONS.md).

## Troubleshooting

**Migrations fail** — ensure `POSTGRES_PASSWORD` matches `DATABASE_URL`.

**Worker idle** — confirm `REDIS_URL` points at the `redis` service hostname inside Compose (`redis://redis:6379/0`).

**Uploads 403** — wait for `minio-init` to finish; check MinIO console at :9001.

**imgproxy broken images** — set `VITE_IMGPROXY_SIGNATURE=insecure` for local imgproxy with `IMGPROXY_ALLOW_INSECURE=1`.

**Stale API routes after code changes** — run `pnpm run docker:up:build`.

## SSO / SAML testing

The default stack does not include an Identity Provider. To verify console SSO registration and SP-initiated login against a local SimpleSAMLphp IdP:

```bash
pnpm dotenvx run -f .env.docker -- docker compose --profile sso-test up -d sso-idp
```

Full runbook (metadata URLs, console field values, demo user, manual login steps): **[SSO-TESTING.md](./SSO-TESTING.md)**.

## See also

- [docs/README.md](./README.md) — per-package documentation
- [docs/SSO-TESTING.md](./SSO-TESTING.md) — local SAML IdP runbook
- [docs/AUDIT.md](./AUDIT.md) — platform feature audit
