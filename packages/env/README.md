# @saasweave/env

Validated environment variables using `@t3-oss/env-core` and Zod.

## Modules

| Import                              | Scope                                       |
| ----------------------------------- | ------------------------------------------- |
| `@saasweave/env/server/env`         | `ENV_SERVER` — server, worker, migrations   |
| `@saasweave/env/web/env.isomorphic` | `ENV_WEB_ISOMORPHIC` — client-safe web vars |
| `@saasweave/env/web/env.server`     | `ENV_WEB_SERVER` — SSR-only web vars        |

## Templates

- [`packages/env/.env.example`](./.env.example) — native `vp run dev`
- [`.env.docker.example`](../../.env.docker.example) — Docker Compose

## Required (all runtimes)

- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (min 32 characters)
- `VITE_SERVER_URL`, `VITE_WEB_URL`

## Optional groups

See [docs/LOCAL-STACK.md](../../docs/LOCAL-STACK.md) for what each optional group enables (Redis, Stripe, MinIO, mail, OAuth).

## Notes

- `emptyStringAsUndefined: true` — blank strings become unset
- `IS_BUILD` — set during Docker build to skip runtime-only guards (weak-secret, Redis, mail, credential groups). Runtime production invariants still apply when `IS_BUILD=false`.
- Production mail: `REQUIRE_EMAIL_VERIFICATION=true` rejects `MAIL_PROVIDER=console`; `resend` needs a valid `re_...` `RESEND_API_KEY`; `smtp` needs a valid `SMTP_URL`.
- Optional integrations (OAuth, Stripe, MinIO) must be fully configured or fully disabled — partial credential groups fail at startup.
- `SECURITY_CSP_REPORT_ONLY` / `SECURITY_CSP_REPORT_URI` control CSP enforcement and violation reporting. The API also accepts `POST /csp-report` as a built-in collector.
- HSTS is emitted only when `NODE_ENV=production`. Preload is intentionally not enabled; add `preload` only after deliberate HSTS rollout.
