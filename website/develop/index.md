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

The repository packages a couple of task-scoped playbooks as agent skills under
`.agents/skills/`. Each skill is a thin activation wrapper (when to use it and a
short procedure); the durable knowledge lives in reference docs that read as
standalone engineering guides. Those reference docs are below.

- [Building a feature end-to-end](/develop/skills/feature-building): every cross-cutting surface a new toggleable feature touches, with the concrete repo pattern for each.
- [Redis, queues, and caching](/develop/skills/redis-cache-jobs): package boundaries and the cache, queue, and retention patterns.
