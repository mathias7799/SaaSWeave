# @saasweave/db

PostgreSQL access via Drizzle ORM: schema, migrations, and query helpers.

## Schema areas

| Domain        | Tables / notes                                            |
| ------------- | --------------------------------------------------------- |
| Auth          | users, sessions, orgs, members, invitations (Better Auth) |
| Platform      | `platform_settings`, `feature_flag`, audit                |
| Billing       | subscriptions, usage records                              |
| API keys      | hashed secrets, metadata                                  |
| Notifications | in-app feed                                               |
| Webhooks      | `webhook_endpoint`, `webhook_delivery`                    |
| Media         | `media_asset`                                             |
| SSO           | `sso_provider`                                            |
| 2FA           | `two_factor`                                              |

## Always on

- `migrateDatabase()` — runs on server startup
- `db` client (connection pool)
- Audit recording helpers
- Webhook target queries

## Scripts

```bash
vp run db:migrate      # apply migrations
vp run db:generate     # new migration from schema
vp run db:studio       # Drizzle Studio
vp run db:dev:start    # local Postgres only (docker-compose.dev.yaml)
```

## Environment variables

| Variable       | Required |
| -------------- | -------- |
| `DATABASE_URL` | Yes      |

## Tests

```bash
pnpm --filter @saasweave/db test:unit
```

## Related

- [packages/auth](../auth/README.md) — Drizzle adapter for Better Auth
