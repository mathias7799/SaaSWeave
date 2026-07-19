# Package reference

SaaSWeave is a pnpm monorepo. Three runnable applications sit above fourteen
shared packages under the `@saasweave/*` scope. Every link below points at the
package README in the repository.

## Applications

| Service | Description                                                     |
| ------- | --------------------------------------------------------------- |
| [web](https://github.com/mathias7799/SaaSWeave/blob/main/apps/web/README.md)       | TanStack Start UI: marketing, auth, console                     |
| [server](https://github.com/mathias7799/SaaSWeave/blob/main/apps/server/README.md) | Hono API, auth handler, Stripe webhooks, media                  |
| [worker](https://github.com/mathias7799/SaaSWeave/blob/main/apps/worker/README.md) | BullMQ processors: email, notifications, Stripe, webhooks, cron |

## Shared packages

| Package       | Description                                    |
| ------------- | ---------------------------------------------- |
| [core](https://github.com/mathias7799/SaaSWeave/blob/main/packages/core/README.md)                   | Domain types, feature catalog, webhooks, media |
| [env](https://github.com/mathias7799/SaaSWeave/blob/main/packages/env/README.md)                     | Validated environment variables                |
| [db](https://github.com/mathias7799/SaaSWeave/blob/main/packages/db/README.md)                       | Drizzle schema, migrations, queries            |
| [app](https://github.com/mathias7799/SaaSWeave/blob/main/packages/app/README.md)                     | Worker-safe application services               |
| [jobs](https://github.com/mathias7799/SaaSWeave/blob/main/packages/jobs/README.md)                   | BullMQ queues, dispatch, schedules             |
| [auth](https://github.com/mathias7799/SaaSWeave/blob/main/packages/auth/README.md)                   | Better Auth config, SSO, 2FA, platform policy  |
| [api](https://github.com/mathias7799/SaaSWeave/blob/main/packages/api/README.md)                     | oRPC routers, client boundaries, HTTP dispatch |
| [cache](https://github.com/mathias7799/SaaSWeave/blob/main/packages/cache/README.md)                 | Redis cache and rate limiting                  |
| [logger](https://github.com/mathias7799/SaaSWeave/blob/main/packages/logger/README.md)               | Structured logging (evlog)                     |
| [observability](https://github.com/mathias7799/SaaSWeave/blob/main/packages/observability/README.md) | Prometheus metrics and HTTP instrumentation    |
| [mailer](https://github.com/mathias7799/SaaSWeave/blob/main/packages/mailer/README.md)               | Transactional email templates                  |
| [i18n](https://github.com/mathias7799/SaaSWeave/blob/main/packages/i18n/README.md)                   | Paraglide.js messages                          |
| [ui](https://github.com/mathias7799/SaaSWeave/blob/main/packages/ui/README.md)                       | shadcn/ui component library                    |
| [seo](https://github.com/mathias7799/SaaSWeave/blob/main/packages/seo/README.md)                     | TanStack Start SEO helpers                     |

The [package dependency graph](https://github.com/mathias7799/SaaSWeave/blob/main/docs/PACKAGE-DEPENDENCY-GRAPH.md)
documents package ownership and the enforced direction of dependencies between
them.
