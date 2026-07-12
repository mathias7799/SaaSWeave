# saasweave

Opinionated full-stack TypeScript monorepo: TanStack Start + Hono + oRPC + Drizzle + Better Auth + Paraglide.js, powered by Vite Plus.

Use Vite Plus commands in this repo: `vp` for package/scripts, `vpx` for one-off CLIs.

Common commands:

- `vp run dev` - start dev servers
- `vp check --fix` - package-local format, lint fixes, and typecheck
- `vp run -w fix` - workspace fix after cross-package/root changes
- `vp run build` - build all packages

Before substantial work, run `vpx @tanstack/intent@latest list`; load a matching local skill only when it directly fits the task.

Use the smallest relevant doc set below. Open the most specific file first, then follow links from that file only when the task crosses into another concern.

## Cross-Cutting

- [Workflow](.agents/workflow.md): fix cadence, validation scope, build checks, migrations, commits.
- [Vite+ toolchain](.agents/vite-plus.md): `vp`/`vpx`, workspace scripts, package management.
- [Testing](.agents/testing.md): focused unit/e2e coverage and test command scope.
- [Choice flows](.agents/choice-flows.md): native approvals, structured input, human decision points.
- [Logging](.agents/logging.md): durable logs, request logging, redaction, client/server logging.
- [Redis workers cache skill](.agents/skills/redis-workers-cache/SKILL.md): Redis cache, BullMQ queues, worker processors, Docker/Coolify runtime checks.
- [Feature plan skill](.agents/skills/feature-plan/SKILL.md): End-to-end planning for new toggleable features (cache, i18n, flags, API, UI, jobs).

## Backend Ownership

- `packages/core`: pure shared contracts and security limits; no DB, env, network, or framework state.
- `packages/db`: Drizzle schema, migrations, and persistence helpers.
- `packages/app`: worker-safe application services for Stripe application, streaming exports, batch processing, billing math, and storage lifecycle.
- `packages/jobs`: BullMQ queues, dispatch, processors, schedules, retention orchestration, and worker readiness.
- `apps/server`: Hono transport, bounded HTTP bodies, auth/RPC routing, media upload/delivery, and authenticated export downloads.
- `apps/worker`: process lifecycle, signals, health/metrics HTTP, and composition of processors from `packages/jobs`; keep domain logic out.
- `packages/observability`: Prometheus instruments and Hono metrics middleware. Distributed tracing is not configured.

## Task Entry Points

- **Docs index**: [docs/README.md](docs/README.md) — per-package READMEs, [LOCAL-STACK.md](docs/LOCAL-STACK.md), [AUDIT.md](docs/AUDIT.md), [PACKAGE-DEPENDENCY-GRAPH.md](docs/PACKAGE-DEPENDENCY-GRAPH.md).
- UI work: [UI guidelines](.agents/ui.md). Add [TanStack patterns](.agents/tanstack-patterns.md) for routes/loaders/page composition, and [Zustand state management](.agents/zustand.md) for shared client-owned state.
- Shared client state: [Zustand state management](.agents/zustand.md).
- Bugfix: start with the owning domain doc, then [Workflow](.agents/workflow.md). Add [Testing](.agents/testing.md) for regression coverage and [Core package patterns](.agents/core.md) when shared contracts change.
- Uploads or object storage: [Media storage and uploads](.agents/media-storage.md), plus [Core](.agents/core.md), [oRPC](.agents/orpc.md), and [Environment variables](.agents/environment-variables.md) as needed.
- End-to-end feature: [End-to-end feature workflow](.agents/end-to-end-features.md), then the domain docs it links.
- Background processing, caching, retention, or worker/Docker changes: [Redis workers cache skill](.agents/skills/redis-workers-cache/SKILL.md).

## Domain Docs

- [TanStack patterns](.agents/tanstack-patterns.md): route structure, `beforeLoad`, layouts, route-level preloading, TanStack docs lookup.
- [API fetching patterns](.agents/api-fetching-patterns.md): slice-local TanStack Query and oRPC client wrappers in `apps/web`.
- [oRPC patterns](.agents/orpc.md): server procedures, router shape, typed errors, request-scoped handler logging.
- [Auth patterns](.agents/auth.md): Better Auth architecture, auth query behavior, protected/guest route rules.
- [i18n guidelines](.agents/i18n.md): copy keys, locale file policy, Paraglide codegen.
- [SEO patterns](.agents/seo.md): route `head()` usage and `@saasweave/seo`.
- [Core package patterns](.agents/core.md): shared domain contracts in `packages/core`.
- [TypeScript conventions](.agents/typescript.md): schema placement, import boundaries, `lib/` vs `utils/`.
- [Environment variables](.agents/environment-variables.md): env scoping, validation, Docker propagation.
