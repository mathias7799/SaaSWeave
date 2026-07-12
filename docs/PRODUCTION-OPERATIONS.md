# Production operations runbook

Last updated: 2026-07-12

Operator guide for backups, recovery, observability, container hardening, and data retention on
SaaSWeave. Local Docker defaults are documented in [LOCAL-STACK.md](./LOCAL-STACK.md); this runbook
defines **production** expectations.

## First deployment preflight

Before starting the Coolify stack, set these required values:

- `BETTER_AUTH_SECRET` generated with `pnpm run auth:secret`
- `PLATFORM_ADMIN_EMAILS` with at least one operator email
- `MAIL_PROVIDER=resend|smtp`, a verified `MAIL_FROM`, and the selected provider credential
- `MINIO_ACCESS_KEY_ID`, `MINIO_SECRET_ACCESS_KEY`, and the externally reachable
  `MINIO_PUBLIC_BASE_URL`
- `METRICS_BEARER_TOKEN` with at least 32 characters when metrics are enabled

Runtime guards fail closed when administrator, mail, Redis, metrics, or object-storage groups are
partially configured. The root `docker-compose.yaml` is a loopback-bound local stack; use
`docker-compose.coolify.yaml` or managed services for production.

## Ownership

| Area                                  | Primary owner             | Escalation                             |
| ------------------------------------- | ------------------------- | -------------------------------------- |
| Platform uptime (web, server, worker) | On-call engineer          | Engineering lead                       |
| PostgreSQL backups & PITR             | Infrastructure / DBA      | Engineering lead                       |
| Object storage (MinIO/S3) lifecycle   | Infrastructure            | Security + Engineering                 |
| Redis persistence & queues            | Infrastructure            | On-call engineer                       |
| Secret rotation                       | Security + Infrastructure | Engineering lead                       |
| Incident commander                    | On-call engineer          | Engineering lead + Legal (data breach) |
| Retention & legal hold                | Product + Legal           | Engineering (execution)                |

## Recovery objectives

| Tier                    | RPO        | RTO        | Scope                                             |
| ----------------------- | ---------- | ---------- | ------------------------------------------------- |
| **Tier 1 — core app**   | 15 minutes | 60 minutes | Web, server, worker serving authenticated traffic |
| **Tier 2 — async jobs** | 1 hour     | 4 hours    | BullMQ queues, exports, webhooks (replay-safe)    |
| **Tier 3 — analytics**  | 24 hours   | 24 hours   | Usage aggregates, MRR snapshots (recomputable)    |

## Backups

### PostgreSQL

- **Frequency:** continuous WAL archiving / managed PITR where available; otherwise full daily + WAL every 5 minutes.
- **Retention:** 35 daily restore points minimum; 90 days for compliance-sensitive tenants when contracted.
- **Encryption:** AES-256 at rest (disk/volume or managed service); backups encrypted in transit (TLS) and at rest in object storage.
- **PITR:** prefer managed Postgres (RDS, Cloud SQL, Supabase, Neon) with point-in-time restore. Self-hosted: `archive_mode=on`, `archive_command` shipping to S3/MinIO, tested `pg_basebackup` + WAL replay.

### MinIO / S3 uploads bucket

- **Versioning:** enable bucket versioning in production.
- **Lifecycle:** transition noncurrent versions to infrequent access after 30 days; expire noncurrent versions after 90 days unless legal hold.
- **Cross-region replication:** required for production multi-AZ; async replication to secondary region.

### Redis

- **Role:** cache + BullMQ metadata — **not** a system of record.
- **Persistence:** AOF (`appendonly yes`) with `appendfsync everysec` on the Redis volume for faster queue recovery after host failure.
- **Backup:** nightly RDB snapshot to encrypted object storage; expect to replay/re-enqueue idempotent jobs after full Redis loss.

### Secrets

Rotate on schedule or immediately after suspected compromise:

| Secret                  | Cadence             | Procedure                                                                         |
| ----------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`    | 90 days             | Generate new secret, rolling deploy all server/web replicas, invalidate sessions  |
| `STRIPE_WEBHOOK_SECRET` | on Stripe rotation  | Update env, redeploy server, verify webhook delivery metrics                      |
| `MINIO_*` / IAM keys    | 90 days             | Create new key, update env, revoke old key after deploy                           |
| DB credentials          | 90 days             | Managed provider rotation or `ALTER ROLE`, update `DATABASE_URL`, rolling restart |
| OAuth client secrets    | per provider policy | Update provider console + env                                                     |

## Restore procedure

1. **Declare incident** — assign IC, start comms channel, freeze deploys.
2. **Identify scope** — app-only vs database vs object storage vs Redis.
3. **Postgres PITR**
   - Stop writes: scale server/worker to 0 or enable maintenance mode.
   - Restore to **new** instance or new database name — never overwrite production in place without IC approval.
   - Run `pnpm run db:migrate` only if restored snapshot is **older** than target release schema.
   - Point `DATABASE_URL` at restored instance; smoke `GET /server/health/ready`.
4. **Object storage** — restore affected keys from versioned bucket or cross-region replica.
5. **Redis** — rebuild from AOF/RDB or cold-start; re-enqueue failed exports/webhooks from DB state.
6. **Validate** — run backup/restore drill script against restored clone; verify audit marker integrity.
7. **Resume traffic** — rolling bring-up web → server → worker; watch error rate alerts.

## Rollback procedure

1. Re-deploy previous immutable image digest (see `SOURCE_COMMIT` / registry tag).
2. If migrations ran forward-only, **do not** auto-reverse — restore DB from pre-deploy snapshot if schema incompatible.
3. Confirm `/server/health/ready` and worker `GET :9100/health/ready`.
4. Monitor `http_requests_total{status_class="5xx"}` for 30 minutes.

## Migration compatibility

- Migrations run as a **single pre-deploy** step (`pnpm run db:migrate`) with Postgres advisory
  lock - safe for one runner only.
- Roll-forward only; backward-compatible API for at least one release when changing columns.
- Before destructive migrations: take on-demand backup + note restore timestamp.

## Executable verification (local / CI)

```bash
# Safety gate: only localhost/docker hostnames unless BACKUP_RESTORE_ALLOW_REMOTE=true
pnpm run ops:backup-verify

# Compose production + local configs
pnpm run ops:compose-validate
```

The backup drill inserts a disposable `audit_log` marker, `pg_dump`s, restores to an isolated database, compares row count and checksum, then cleans up. A Docker volume alone is **not** a backup.

## Worker readiness

Worker exposes HTTP probes (default port `9100`):

| Probe     | Path            | Pass                                                            |
| --------- | --------------- | --------------------------------------------------------------- |
| Liveness  | `/health/live`  | process responding                                              |
| Readiness | `/health/ready` | Redis, DB, queues, schedulers, workers running, fresh heartbeat |

Readiness checks:

- Redis connectivity
- Queue registration (schedules queue reachable)
- Repeatable schedulers: `expire-invitations`, `snapshot-mrr`, `cleanup-storage`, `data-retention`
- DB `SELECT 1` (processors use Postgres)
- All BullMQ workers `isRunning()`
- Heartbeat ≤ 120s (job activity or 30s timer)

**Shutdown:** on `SIGTERM`/`SIGINT`, readiness flips unhealthy **before** workers drain.

Docker / Coolify healthcheck:

```yaml
test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:9100/health/ready || exit 1"]
start_period: 30s
```

## Metrics and alerts

Prometheus scrape endpoints (when `METRICS_ENABLED=true`):

| Service | Path                         |
| ------- | ---------------------------- |
| Server  | `{VITE_SERVER_URL}/metrics`  |
| Worker  | `http://worker:9100/metrics` |

The server scrape must send `Authorization: Bearer $METRICS_BEARER_TOKEN`. The worker metrics
listener has no application-level authentication and must remain reachable only from the private
service network; do not publish port 9100 through the public proxy.

### Instrumented signals

- HTTP rate, latency, status class
- Auth failures (`auth_failures_total`)
- Rate limit hits (`rate_limit_hits_total`)
- Redis errors (`redis_errors_total`)
- Queue waiting/active/delayed/failed + oldest job age
- Job duration/retries (extend via worker hooks)
- Webhook delivery failures
- Export duration/size (record at processor)
- Storage errors
- Process CPU/memory (default Node metrics) + event loop lag

Distributed tracing is not currently configured. Use request IDs to correlate structured logs across services; do not configure tracing alerts until an OpenTelemetry SDK and exporter are deployed.

### Alert thresholds (starting points)

| Alert             | Condition                                    | Severity |
| ----------------- | -------------------------------------------- | -------- |
| HighErrorRate     | 5xx / total > 2% for 5m                      | page     |
| AuthFailureSpike  | `rate(auth_failures_total[5m])` > 10/s       | page     |
| ReadyCheckFailing | `/health/ready` != 200 for 2m                | page     |
| QueueBacklog      | `queue_jobs_waiting` > 1000 for 15m          | ticket   |
| QueueLag          | `queue_oldest_job_age_seconds` > 3600        | ticket   |
| FailedJobs        | `queue_jobs_failed` > 100                    | ticket   |
| RedisErrors       | `increase(redis_errors_total[5m])` > 0       | page     |
| EventLoopLag      | `nodejs_event_loop_lag_seconds` > 0.5 for 5m | ticket   |
| DiskBackupStale   | no successful backup object in 26h           | page     |

## Container hardening (production)

Production compose (`docker-compose.coolify.yaml`) applies:

- Non-root UIDs (server/web/worker images)
- `read_only: true` + `tmpfs /tmp` for app containers
- `no-new-privileges`, `cap_drop: [ALL]`, `init: true` (zombie reaping)
- CPU/memory/PID limits
- JSON log rotation (`max-size` / `max-file`)
- `restart: unless-stopped`
- Internal network only — **no published** Postgres, Redis, or MinIO admin ports
- Immutable image tags/digests via Coolify build (`SOURCE_COMMIT`)

Local `docker-compose.yaml` keeps admin ports for developer ergonomics.

## Data retention

Scheduled job `data-retention` (default cron `0 5 * * *` UTC) purges aged rows in chunks (`500`/pass). Defaults in `@saasweave/core/retention`:

| Class                   | Default retention               | Notes                              |
| ----------------------- | ------------------------------- | ---------------------------------- |
| Security audit log      | **730 days**                    | Never use notification default     |
| Notifications           | 90 days                         |                                    |
| Webhook deliveries      | 30 days                         |                                    |
| Processed events        | 90 days                         |                                    |
| Data export records     | 30 days after expiry/revocation | Files cleaned by `cleanup-storage` |
| Usage events            | 395 days                        | ~13 months billing                 |
| Email deliveries        | 90 days                         |                                    |
| MRR snapshots           | 1,825 days                      | 5 years                            |
| Batch jobs (terminal)   | 90 days                         |                                    |
| BullMQ completed/failed | 14 days                         | `queue.clean()`                    |
| Orphan media            | code-owned                      | `cleanup-storage` schedule         |

Configuration:

- `RETENTION_PURGE_DRY_RUN=true` — count only, no deletes
- `RETENTION_LEGAL_HOLD_ORG_IDS=org_abc,org_def` — skip org-scoped rows

Metrics: `retention_purged_rows_total{class,dry_run}`.

## Incident triage

1. Check status: `/server/health/ready`, worker `:9100/health/ready`.
2. Grafana/dashboards: error rate, queue lag, DB pool, Redis errors.
3. Logs: filter by `requestId`, redacted by default.
4. Classify: **SEV1** full outage, **SEV2** partial/degraded, **SEV3** single-tenant.
5. Mitigate: scale, disable feature flag, maintenance mode, rollback digest.
6. Post-incident: timeline, root cause, backup/restore proof, action items.

## Disaster recovery drills

| Drill                        | Frequency   | Success criteria                       |
| ---------------------------- | ----------- | -------------------------------------- |
| Backup restore verify script | monthly     | checksum match                         |
| Full PITR to staging         | quarterly   | app smoke + auth login                 |
| Worker failover              | quarterly   | readiness green < 2 min                |
| Secret rotation              | semi-annual | zero-downtime deploy                   |
| Retention dry-run            | monthly     | metrics emitted, no unexpected deletes |

## Related docs

- [LOCAL-STACK.md](./LOCAL-STACK.md) — local Docker stack
- [.agents/skills/redis-workers-cache/SKILL.md](../.agents/skills/redis-workers-cache/SKILL.md) — Redis/worker patterns
- [.agents/logging.md](../.agents/logging.md) — logging and redaction
