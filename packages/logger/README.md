# @saasweave/logger

Structured logging built on [evlog](https://github.com/evlogjs/evlog) with Hono middleware helpers.

## Always on

- `createLogger()` — request-scoped child loggers
- `initLogger()` — service metadata (name, version, environment)
- `LOG_SERVICES` — constants for web, server, worker

## Key exports

- `@saasweave/logger/server` — server/worker logging
- `@saasweave/logger/server/hono/middleware` — request/response logging
- `@saasweave/logger/client` — browser logging (web)

## Environment variables

Uses `NODE_ENV` and `SOURCE_COMMIT` from `ENV_SERVER` / web env for log context.

## Related

Used by all apps and `packages/jobs` dispatch paths.
