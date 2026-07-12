# Contributing to SaaSWeave

Thank you for helping improve SaaSWeave. Contributions should be focused, testable, and compatible
with the repository's package boundaries.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Use a feature request for substantial product or architecture changes before implementation.
- Never open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
- Keep pull requests scoped to one coherent problem.

## Development setup

Use Node.js `24.18.0`, pnpm `11.3.0`, and Docker Compose v2.

```bash
corepack enable
pnpm install --frozen-lockfile
cp packages/env/.env.example packages/env/.env
vp run auth:secret
pnpm run db:dev:start
pnpm run db:migrate
vp run dev
```

For the full containerized stack, copy `.env.docker.example` to `.env.docker`, set
`BETTER_AUTH_SECRET`, and run `pnpm run docker:up:build`.

## Repository conventions

- Use Vite Plus commands (`vp` and `vpx`) for repository scripts and one-off tools.
- Follow existing TypeScript, TanStack, oRPC, auth, i18n, and package patterns.
- Keep browser modules free of database, server environment, and privileged auth imports.
- Import public package exports; do not deep-import another package's `src` tree.
- Put shared domain contracts in `packages/core`, persistence in `packages/db`, worker-safe services
  in `packages/app`, queue orchestration in `packages/jobs`, and transport procedures in
  `packages/api`.
- Add user-facing copy through Paraglide messages when the surrounding feature is localized.
- Do not commit secrets, populated environment files, coverage output, build output, or generated
  Paraglide files unless the repository explicitly tracks them.

## Making changes

1. Create a branch from the latest `main`.
2. Add or update behavior-focused tests with the implementation.
3. Run the narrowest package check while developing.
4. Run broader workspace gates when changing shared contracts or configuration.
5. Document new environment values, migrations, operational requirements, and user-visible behavior.

Package-local validation:

```bash
cd packages/core # or the app/package you changed
vp check --fix
vp test
```

Workspace validation:

```bash
vp run -w fix
pnpm run test:unit:run
vp run build
pnpm run coverage:gate
```

Use unit tests for contracts and local behavior, integration tests for real database/Redis behavior,
and Playwright for browser workflows. Assertions must verify outcomes or side effects; avoid
snapshot-only and assertion-free tests.

## Database migrations

Edit schema modules under `packages/db/src/schema`, then:

```bash
vp run db:generate
vp run db:migrate
```

Before applying a migration, confirm `DATABASE_URL` points to localhost or an explicitly disposable
development database. Include generated migration files in the pull request and describe rollout or
backfill implications. Do not rewrite migrations that may already have been applied by others.

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), for example:

```text
feat(billing): add annual checkout interval
fix(worker): close queue connections on shutdown
test(auth): cover expired invitation rejection
```

Pull requests should explain the problem and solution, list exact validation commands, link related
issues, and include screenshots or recordings for visible UI changes. Call out migrations,
environment changes, security impact, compatibility concerns, and follow-up work.

Maintainers may request a smaller change, additional tests, or an architecture discussion before
merge. Approval does not guarantee immediate merge or release.

## Conduct and licensing

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). By contributing, you agree
that your contribution is licensed under the repository's [MIT License](LICENSE).
