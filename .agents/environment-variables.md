# Environment Variables

## Single Source of Truth

All env vars live in `packages/env/.env` (copy from `.env.example`). Validated by Zod at import time via `@t3-oss/env-core`.

## Three Scoped Objects

| Object               | Scope                                                                |
| -------------------- | -------------------------------------------------------------------- |
| `ENV_SERVER`         | Server-only (`apps/server`, `apps/worker`, SSR and backend packages) |
| `ENV_WEB_ISOMORPHIC` | Client + server (`apps/web`)                                         |
| `ENV_WEB_SERVER`     | Web server-only                                                      |

## Client Exposure Rule

Only vars prefixed with `VITE_` are available on the client (`import.meta.env`). Server-only vars (`DATABASE_URL`, `BETTER_AUTH_SECRET`) must never be exposed to the client.

## When Adding/Updating Env Vars

Update only the surfaces that consume or propagate the value, and keep them synchronized:

1. `packages/env/src/` — add Zod validation to the appropriate scoped object
2. `packages/env/.env.example` and `.env.docker.example` — add safe local/deployment placeholders
3. `docker-compose.yaml` and `docker-compose.coolify.yaml` — propagate to affected runtime services
4. Relevant Dockerfile `ARG`/`ENV` only when the value is genuinely required at image build time; do not bake runtime secrets into images
5. `packages/env/README.md` or the owning package/runbook — document scope, requirement, and production behavior
6. `apps/web/vite.config.ts` build dependencies only for web build-time values; never put server secrets in `define`

Missing any of these causes build or runtime failures with no obvious error message.

Env docs and templates must mirror the validated schema in `packages/env/src/`. Do not invent, retain, or document env vars that are not actually read there. If a setting is code-owned, document it as code-owned instead of adding a new env knob.

## Gotchas

- `z.stringbool()` is used for boolean env vars (parses "true"/"false" strings)
- Dev defaults exist for most `VITE_*` vars; `DATABASE_URL` and `BETTER_AUTH_SECRET` are always required
- Production-only invariants live in `packages/env/src/server/production-guards.ts` (Redis, mail delivery, metrics token, provider credential completeness). Update tests there when changing a guarded provider or security setting.
- Each env file logs loading with `console.debug` — check terminal output for validation errors
