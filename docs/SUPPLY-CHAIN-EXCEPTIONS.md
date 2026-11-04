# Time-bounded supply-chain exceptions

Last updated: 2026-11-04

## Pre-release framework pins

| Package                       | Pin                                     | Review by  | Rationale                                                                                       | Mitigation                         |
| ----------------------------- | --------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- | ---------------------------------- |
| `drizzle-orm` / `drizzle-kit` | `1.0.0-rc.5`                            | 2027-02-04 | Drizzle 1.0 stable is still unpublished (`latest` remains 0.45.x)                               | Migrations + integration tests     |
| `nitro`                       | `nitro-nightly@3.0.1-20261101-051726-*` | 2027-02-04 | TanStack Start still requires Nitro 3 nightly APIs; the `nitro` dist-tag is a release candidate | Pin exact nightly hash in catalog  |
| `@typescript/native-preview`  | `7.0.0-dev.20260707.2`                  | 2027-02-04 | Vite Plus type-aware oxlint still peers the native TypeScript preview                           | Dev-only; `typescript@7.0.2` emits |

## Audit allowlist

See [`.github/audit-allowlist.json`](../.github/audit-allowlist.json). Every exception must include
all of the following non-empty fields:

- `id`: upstream advisory identifier, normally a GHSA identifier
- `affected_path`: the production dependency path that introduces the advisory
- `exploitability`: repository-specific reachability and impact analysis
- `owner`: team responsible for removing or renewing the exception
- `added_date`: ISO `YYYY-MM-DD` date the exception was accepted
- `review_by`: ISO `YYYY-MM-DD` expiry/review date
- `upstream_url`: HTTPS advisory, fix, or tracking link

CI rejects incomplete, duplicate, future-dated, and expired entries. It also parses the pre-release
framework-pin table above and rejects stale or malformed rows through
`scripts/ci/framework-exceptions-check.mjs`.

## Node runtime

Production Docker images and CI use **Node 24** (`.node-version`, currently 24.22.2). Node 25 is not used in production paths.
