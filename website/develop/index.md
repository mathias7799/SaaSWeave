# Development guide

SaaSWeave ships the same repo-specific guidance its maintainers and coding
agents work from. These pages document the current preferred way to build things
in this codebase, from transport and state to logging and tests. They are
mirrored from the `.agents/` directory in the repository, which stays the single
source of truth.

Open the most specific page first, then follow its links only when a task
crosses into another concern.

## Working in the codebase

- [Workflow](/develop/workflow): fix cadence, validation scope, build checks, migrations, commits.
- [Vite Plus toolchain](/develop/vite-plus): `vp` and `vpx`, workspace scripts, package management.
- [TypeScript conventions](/develop/typescript): typing rules and patterns used throughout the repo.
- [Testing](/develop/testing): focused unit and end-to-end coverage and test command scope.
- [Choice flows](/develop/choice-flows): native approvals, structured input, human decision points.

## Backend

- [Core contracts](/develop/core): pure shared contracts and security limits.
- [Environment variables](/develop/environment-variables): validated configuration schemas.
- [Auth patterns](/develop/auth): Better Auth on the server, client, and SSR.
- [oRPC patterns](/develop/orpc): procedures, routers, and client integration.
- [API fetching patterns](/develop/api-fetching-patterns): query and mutation conventions.
- [Logging](/develop/logging): durable logs, request logging, redaction.
- [Media storage](/develop/media-storage): uploads, delivery, and storage lifecycle.
- [End-to-end features](/develop/end-to-end-features): how a feature threads through every layer.

## Frontend

- [TanStack patterns](/develop/tanstack-patterns): Router and Query usage in the web app.
- [Zustand state](/develop/zustand): client state stores and conventions.
- [UI components](/develop/ui): the shared component library and theme tokens.
- [Internationalization](/develop/i18n): Paraglide messages and localized routing.
- [SEO](/develop/seo): route metadata helpers.

## Agent skills

Packaged, task-scoped playbooks a coding agent (or a person) can follow end to end.

- [Feature plan](/develop/skills/feature-plan): plan a new toggleable feature across every cross-cutting surface.
- [Redis, workers, cache](/develop/skills/redis-workers-cache): cache, BullMQ queues, worker processors, and runtime checks.
