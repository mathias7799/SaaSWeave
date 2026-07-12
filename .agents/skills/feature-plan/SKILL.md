---
name: feature-plan
description: Plan new SaaSWeave platform features end-to-end before coding — data model, core contracts, API, cache, jobs, auth, feature flags, i18n, console UI, admin, tests, and validation. Use when the user asks for a feature plan, implementation plan, backlog item design, or "how should we build X" for this monorepo.
---

# Feature Plan (SaaSWeave)

Produce a **plan only** unless the user explicitly asks to implement. Plans must account for every cross-cutting surface the feature might touch — not just API + UI.

## Before planning

1. Read the smallest relevant doc set from `AGENTS.md` (start with [.agents/end-to-end-features.md](../../end-to-end-features.md)).
2. Scan existing capabilities in `packages/core/src/features/types.ts` (`DEFAULT_FEATURES`, `PLANNED_FEATURES`) — reuse patterns from similar shipped features.
3. Grep the codebase for an existing partial implementation before designing from scratch.

## Shipped feature inventory (reference)

| Key              | Category | Typical surfaces                                                      |
| ---------------- | -------- | --------------------------------------------------------------------- |
| `api_keys`       | Core     | DB, API keys lib, console `/app/api-keys`, webhooks events            |
| `api_key_scopes` | Core     | `packages/core/api-keys`, `requireApiKeyScope`, key create UI         |
| `webhooks`       | Core     | DB, console webhooks, `dispatchOrgWebhook`, signing                   |
| `ai_assistant`   | AI       | Console AI usage, metered billing, cache on reads                     |
| `sso`            | Security | Better Auth SSO plugin, settings panel, SAML registration             |
| `audit_logs`     | Security | `recordAudit`, console `/app/audit`, admin audit                      |
| `audit_export`   | Security | Export API, rate limit, CSV/JSON, `audit_export` + `audit_logs` flags |
| `ip_allowlist`   | Security | DB rules, `orgProcedure` IP enforcement, settings panel, cache 60s    |
| `magic_link`     | Security | Better Auth plugin, mailer template, global flag, auth rate limit     |
| `usage_billing`  | Billing  | `recordUsage`, Stripe meters, billing meters UI                       |
| `annual_billing` | Billing  | Stripe `STRIPE_PRICES`, checkout guard, billing UI interval toggle    |

Roadmap-only keys live in `PLANNED_FEATURES` — do not plan them as toggleable until a real surface exists.

## Planning workflow

### Phase 1 — Problem & scope

Answer in the plan:

- **User outcome** — who benefits (workspace member, admin, integration caller)?
- **Auth path** — session only, API key, public, or platform admin?
- **Tenant scope** — per-organization, platform-wide, or user?
- **Feature flag** — new key in `DEFAULT_FEATURES` (shipped) or `PLANNED_FEATURES` (roadmap)? Category?
- **Plan gating** — which `availableOn` plan ids?

### Phase 2 — Cross-cutting decision matrix

For each row, state **Yes / No / N/A** and the concrete approach. Do not skip rows — mark N/A with one line why.

| Concern                   | When Yes                                         | Pattern in repo                                                                                 |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **DB migration**          | New/changed persisted fields                     | `packages/db/src/schema/`, `vp run db:generate`, `vp run db:migrate`                            |
| **Core contract**         | Shared enums, limits, formatters across packages | `packages/core/src/<domain>/`, export in `package.json`                                         |
| **Feature flag (org)**    | Toggle per workspace                             | `requireFeature("key")`, `isFeatureEnabledForOrg`, `requireConsoleFeature`, nav `featureKey`    |
| **Feature flag (global)** | Auth/platform behavior without org context       | `isFeatureGloballyEnabled` in `packages/db/src/features.ts`                                     |
| **API procedure**         | New/changed RPC                                  | `orgProcedure`, `integrationProcedure`, `adminProcedure`, `requireApiKeyScope`                  |
| **IP allowlist**          | Org/integration mutations when `ip_allowlist` on | Automatic on `orgProcedure` / `integrationProcedure` via `assertIpAllowedForOrganization`       |
| **Audit log**             | Security-relevant mutations                      | `recordAudit()` — never throw from audit                                                        |
| **Webhooks**              | External notification of domain events           | `dispatchOrgWebhook`, extend `WEBHOOK_EVENTS` in core                                           |
| **Cache read**            | Expensive repeated reads, stable for TTL         | `cacheWrap` + tags — see [redis-workers-cache](../redis-workers-cache/SKILL.md)                 |
| **Cache invalidate**      | Writes that stale cached reads                   | `cacheInvalidateTag` after mutation                                                             |
| **Rate limit**            | Abuse-sensitive endpoints (export, auth, bulk)   | `checkRateLimit` in handler or `authRateLimitMiddleware`                                        |
| **Application service**   | Domain flow reused inline and by workers         | Worker-safe `packages/app` module; no oRPC/BullMQ imports                                       |
| **Background job**        | Slow/async work (email, webhooks, heavy export)  | `packages/jobs` queue + processor; `apps/worker` only hosts lifecycle                           |
| **Retention**             | New durable or stored data                       | DB purge query + app storage delete + `packages/jobs/src/retention/` orchestration              |
| **Observability**         | New critical provider/job workflow               | Existing instruments in `@saasweave/observability`; bounded stable labels only                  |
| **Request/body limits**   | Public upload, webhook, ingest, bulk, or export  | Shared limits in `packages/core/security`; stream before parsing                                |
| **Auth plugin**           | New sign-in method or session behavior           | `packages/auth/src/index.ts`, client plugin, `getPublicAuthProviderFlags`                       |
| **Mailer template**       | Transactional email                              | `packages/mailer/src/templates/registry.tsx`, `dispatchTemplateEmail`                           |
| **Env vars**              | New secrets or config                            | `packages/env`, `.env.example`, `.env.docker.example`                                           |
| **i18n**                  | Any user-visible copy                            | `packages/i18n/messages/en.json` + `apps/web/src/shared/lib/console-messages.ts` or `m.auth__*` |
| **Console route**         | Workspace UI                                     | `apps/web/src/pages/console/`, route in `(console-layout)/app/`                                 |
| **Console nav**           | New sidebar item                                 | `console-nav.config.ts` + `featureKey`                                                          |
| **Admin surface**         | Platform operators                               | `packages/api` admin router + `apps/web/src/pages/admin/`                                       |
| **SEO**                   | Public/marketing routes                          | `head()` + `@saasweave/seo`                                                                     |
| **Tests**                 | Non-trivial lib logic or security rules          | Unit near changed module; e2e only for critical paths                                           |

**Do not cache:** auth sessions, API key verification, export blobs, raw audit pages.

### Phase 3 — Layer-by-layer design

Follow implementation order from [end-to-end-features.md](../../end-to-end-features.md):

1. **DB** — tables/columns, indexes, FKs, backfill strategy for existing rows
2. **Core** — Zod schemas, constants, pure helpers (no DB imports in core)
3. **DB helpers** — query/export functions in `packages/db` if needed
4. **Application service** — reusable domain/storage/provider logic in `packages/app`
5. **Jobs/mailer** — queue orchestration, processors, schedules, retention, notifications
6. **API** — router shape, inputs, typed errors, enforcement middleware chain
7. **Web data layer** — `*.query.ts` / `*.mutation.ts` with `queryOptions`
8. **Routes & UI** — page, guards, empty/error states
9. **Admin & flags** — seed flag, admin toggle (usually already wired)
10. **Validation** — commands from [workflow.md](../../workflow.md)

### Phase 4 — Plan output format

Write the plan to `docs/plans/<feature-slug>.md` (or deliver in chat if the user only wants a draft). Use this structure:

```markdown
# <Feature name> (`<feature_key>`)

## Goal

One paragraph: problem, user, success criteria.

## Current state

| Area | Status |
| ---- | ------ |
| ...  | ...    |

## Feature flag

- key, category, default `enabled`, `availableOn`
- Org-scoped vs global enforcement

## Cross-cutting checklist

| Concern       | Decision | Notes              |
| ------------- | -------- | ------------------ |
| DB migration  | Yes/No   | ...                |
| Core contract | Yes/No   | ...                |
| Cache         | Yes/No   | key, TTL, tags     |
| Rate limit    | Yes/No   | key, limit, window |
| i18n          | Yes/No   | key prefixes       |
| ...           | ...      | ...                |

## Data model

Schema snippets or field list; migration notes; legacy behavior.

## API

| Procedure | Auth | Middleware | Scopes |
| --------- | ---- | ---------- | ------ |
| ...       | ...  | ...        | ...    |

## Web UI

| Surface | Gating | Work |
| ------- | ------ | ---- |
| ...     | ...    | ...  |

## Phases

| Phase | Deliverable | Validation        |
| ----- | ----------- | ----------------- |
| 1a    | ...         | `vp check` in ... |
| 1b    | ...         | unit test ...     |

## Tests

- Bullet list of meaningful tests (not trivial UI asserts)

## Open questions

- Only genuine product/architecture decisions left for the user
```

### Phase 5 — Quality bar before "shipped"

A feature is not ready for `DEFAULT_FEATURES` until:

- [ ] API returns typed errors for expected failure modes
- [ ] Feature off → 403 (or hidden UI) with clear message
- [ ] i18n for all new user-facing strings
- [ ] Audit entries for security-relevant mutations (if applicable)
- [ ] Migration applied locally; `vp run -w fix` clean for touched packages
- [ ] No secrets in code; env documented
- [ ] Nav/route guards match API enforcement
- [ ] Public request bodies are bounded before parsing; private downloads re-authorize at download time
- [ ] New durable data has an explicit retention/delete policy and legal-hold behavior where applicable
- [ ] Job/worker/observability changes preserve their 90% line coverage gates with lifecycle and failure tests

## Similar-feature shortcuts

When planning, explicitly name the **template feature** to copy:

| Building                    | Copy from                                                   |
| --------------------------- | ----------------------------------------------------------- |
| Settings panel CRUD         | `sso-settings-panel.tsx`, `ip-allowlist-settings-panel.tsx` |
| Console list + create sheet | `api-keys-page.tsx`, `webhooks` pages                       |
| Toggleable billing behavior | `annual_billing` + `billing-page.tsx`                       |
| Export + rate limit         | `audit-export.ts`                                           |
| Auth method                 | `magic_link` + `OAuthButtons`                               |
| Scoped API key access       | `api_key_scopes` + `requireApiKeyScope`                     |
| Cached org settings         | `packages/api/src/lib/ip-allowlist.ts`, `settings.ts`       |

## Anti-patterns

- Planning UI before API enforcement exists
- Feature flag in env only (prefer DB + admin toggle; env only for provider secrets)
- Duplicating domain literals in web and API (use `packages/core`)
- Caching auth or API key verification
- Adding to `DEFAULT_FEATURES` before console + API enforcement ship
- Skipping i18n because "it's internal" — console copy always goes through Paraglide

## Additional resources

- Implementation order: [end-to-end-features.md](../../end-to-end-features.md)
- Example multi-feature plan: [docs/plans/FEATURE-IMPLEMENTATION-PLANS.md](../../../docs/plans/FEATURE-IMPLEMENTATION-PLANS.md)
- Cache/jobs: [redis-workers-cache/SKILL.md](../redis-workers-cache/SKILL.md)
- Feature backlog context: [docs/FEATURE-BACKLOG.md](../../../docs/FEATURE-BACKLOG.md)
