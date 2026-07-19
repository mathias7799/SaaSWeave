# Quick start

The fastest way to see SaaSWeave is the complete stack under Docker Compose. A
one-shot migration service applies the database schema before the server and
worker start.

## Prerequisites

- Docker with Compose v2
- Node.js `24.18.0` for repository utilities
- pnpm `11.3.0`

## Start with Docker

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.docker.example .env.docker
pnpm run auth:secret
```

Put the generated value in `BETTER_AUTH_SECRET` inside `.env.docker`, then start
the stack:

```bash
pnpm run docker:up:build
```

Once the containers are healthy, the services are available locally:

| Service             | Local address                                 |
| ------------------- | --------------------------------------------- |
| Web                 | http://localhost:3000                         |
| API                 | http://localhost:5000/server                  |
| MinIO API / console | http://localhost:9000 / http://localhost:9001 |
| imgproxy            | http://localhost:8080                         |
| PostgreSQL          | `localhost:5432`                              |
| Redis               | `localhost:6379`                              |
| Worker health       | http://localhost:9100/health/ready            |

The default stack logs transactional email to the console and runs billing in
sample mode until providers are configured.

Stop the stack without deleting named data volumes:

```bash
pnpm run docker:down
```

::: tip Full stack, not a single process
The web app, the Hono API server, the BullMQ worker, PostgreSQL, Redis, and
MinIO run as separate services. That separation is the point of the starter, so
a trimmed single-process build is not a representative demo of it. For a hosted
demo, run the full stack on infrastructure you control (the repository ships
[`docker-compose.coolify.yaml`](https://github.com/mathias7799/SaaSWeave/blob/main/docker-compose.coolify.yaml)
as a hardened baseline).
:::

## Native development

Copy the native environment template, set a local database URL and auth secret,
and start the infrastructure you need:

```bash
cp packages/env/.env.example packages/env/.env
pnpm run auth:secret
pnpm run db:dev:start
pnpm run db:migrate
pnpm run dev
```

Vite Plus is the repository command surface. Useful commands from the repository
root:

```bash
pnpm run dev               # start workspace development tasks
pnpm run fix               # format, lint and type-check the workspace
pnpm run build             # build all production targets
pnpm run test:unit:run     # run package unit suites with isolated queue state
pnpm run test:e2e:run      # run configured end-to-end suites
pnpm run coverage:gate     # enforce package line-coverage floors
pnpm run maintainability   # warnings, boundaries, cycles and duplication
```

Database schema changes belong in `packages/db/src/schema`. Generate and review a
migration, verify that `DATABASE_URL` points to a local database, then apply it:

```bash
pnpm run db:generate
pnpm run db:migrate
```

Next: [configure providers](/guide/configuration) to turn on Stripe, OAuth,
email delivery, object storage, and metrics.
