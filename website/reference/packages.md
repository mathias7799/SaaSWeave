# Package reference

SaaSWeave is a pnpm monorepo. Three runnable applications sit above fourteen
shared packages under the `@saasweave/*` scope. Each README below is rendered on
this site; use the sidebar to browse them.

## Applications

| Service | Description                                                     |
| ------- | --------------------------------------------------------------- |
| [web](/reference/apps/web)       | TanStack Start UI: marketing, auth, console                     |
| [server](/reference/apps/server) | Hono API, auth handler, Stripe webhooks, media                  |
| [worker](/reference/apps/worker) | BullMQ processors: email, notifications, Stripe, webhooks, cron |

## Shared packages

| Package       | Description                                    |
| ------------- | ---------------------------------------------- |
| [core](/reference/packages/core)                   | Domain types, feature catalog, webhooks, media |
| [env](/reference/packages/env)                     | Validated environment variables                |
| [db](/reference/packages/db)                       | Drizzle schema, migrations, queries            |
| [app](/reference/packages/app)                     | Worker-safe application services               |
| [jobs](/reference/packages/jobs)                   | BullMQ queues, dispatch, schedules             |
| [auth](/reference/packages/auth)                   | Better Auth config, SSO, 2FA, platform policy  |
| [api](/reference/packages/api)                     | oRPC routers, client boundaries, HTTP dispatch |
| [cache](/reference/packages/cache)                 | Redis cache and rate limiting                  |
| [logger](/reference/packages/logger)               | Structured logging (evlog)                     |
| [observability](/reference/packages/observability) | Prometheus metrics and HTTP instrumentation    |
| [mailer](/reference/packages/mailer)               | Transactional email templates                  |
| [i18n](/reference/packages/i18n)                   | Paraglide.js messages                          |
| [ui](/reference/packages/ui)                       | shadcn/ui component library                    |
| [seo](/reference/packages/seo)                     | TanStack Start SEO helpers                     |

The [package dependency graph](/reference/dependency-graph) documents package
ownership and the enforced direction of dependencies between them.
