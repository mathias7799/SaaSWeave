# Documentation index

Public documentation for SaaSWeave apps, packages, local development, operations, and security.

## Apps (runnable services)

| Service | Path                                              | Description                                                     |
| ------- | ------------------------------------------------- | --------------------------------------------------------------- |
| Web     | [apps/web/README.md](../apps/web/README.md)       | TanStack Start UI, marketing, auth, console                     |
| Server  | [apps/server/README.md](../apps/server/README.md) | Hono API, auth handler, Stripe webhooks, media                  |
| Worker  | [apps/worker/README.md](../apps/worker/README.md) | BullMQ processors: email, notifications, Stripe, webhooks, cron |

## Packages (shared libraries)

| Package       | Path                                                                    | Description                                    |
| ------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| api           | [packages/api/README.md](../packages/api/README.md)                     | oRPC routers, client boundaries, HTTP dispatch |
| app           | [packages/app/README.md](../packages/app/README.md)                     | Worker-safe application services               |
| auth          | [packages/auth/README.md](../packages/auth/README.md)                   | Better Auth config, SSO, 2FA, platform policy  |
| cache         | [packages/cache/README.md](../packages/cache/README.md)                 | Redis cache + rate limiting                    |
| core          | [packages/core/README.md](../packages/core/README.md)                   | Domain types, feature catalog, webhooks, media |
| db            | [packages/db/README.md](../packages/db/README.md)                       | Drizzle schema, migrations, queries            |
| env           | [packages/env/README.md](../packages/env/README.md)                     | Validated environment variables                |
| i18n          | [packages/i18n/README.md](../packages/i18n/README.md)                   | Paraglide.js messages                          |
| jobs          | [packages/jobs/README.md](../packages/jobs/README.md)                   | BullMQ queues, dispatch, schedules             |
| logger        | [packages/logger/README.md](../packages/logger/README.md)               | Structured logging (evlog)                     |
| mailer        | [packages/mailer/README.md](../packages/mailer/README.md)               | Transactional email templates                  |
| observability | [packages/observability/README.md](../packages/observability/README.md) | Prometheus metrics and HTTP instrumentation    |
| seo           | [packages/seo/README.md](../packages/seo/README.md)                     | TanStack Start SEO helpers                     |
| ui            | [packages/ui/README.md](../packages/ui/README.md)                       | shadcn/ui component library                    |

## Operations

| Doc                                                          | Description                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [LOCAL-STACK.md](./LOCAL-STACK.md)                           | Run the full stack with Docker Compose                       |
| [SSO-TESTING.md](./SSO-TESTING.md)                           | Local SAML test IdP (`sso-test` compose profile) runbook     |
| [PRODUCTION-OPERATIONS.md](./PRODUCTION-OPERATIONS.md)       | Backups, recovery, retention, metrics, and incident response |
| [PACKAGE-DEPENDENCY-GRAPH.md](./PACKAGE-DEPENDENCY-GRAPH.md) | Package ownership and dependency direction                   |
| [LICENSE-POLICY.md](./LICENSE-POLICY.md)                     | Production dependency license policy                         |
| [SUPPLY-CHAIN-EXCEPTIONS.md](./SUPPLY-CHAIN-EXCEPTIONS.md)   | Time-bounded dependency exceptions                           |

## Related

- [AGENTS.md](../AGENTS.md) — contributor and AI agent workflow
- [CONTRIBUTING.md](../CONTRIBUTING.md) — development and pull-request workflow
- [SECURITY.md](../SECURITY.md) — private vulnerability reporting
- [packages/env/.env.example](../packages/env/.env.example) — native `vp run dev` env template
