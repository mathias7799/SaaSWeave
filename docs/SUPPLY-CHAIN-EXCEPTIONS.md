# Time-bounded supply-chain exceptions

Last updated: 2026-07-11

## Pre-release framework pins

| Package                        | Pin                              | Review by  | Rationale                                                         | Mitigation                                                 |
| ------------------------------ | -------------------------------- | ---------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `better-auth`                  | `1.7.0-rc.1`                     | 2026-10-01 | Stable 1.7 not yet published; SSO + drizzle adapter aligned on rc | Catalog pin, `minimumReleaseAgeExclude`, integration tests |
| `@better-auth/drizzle-adapter` | `1.7.0-rc.1`                     | 2026-10-01 | Same train as better-auth                                         | Same                                                       |
| `@better-auth/sso`             | `1.7.0-rc.1`                     | 2026-10-01 | Same train as better-auth                                         | Same                                                       |
| `drizzle-orm` / `drizzle-kit`  | `1.0.0-rc.4-*`                   | 2026-10-01 | Drizzle 1.0 stable pending                                        | Migrations + integration tests                             |
| `nitro`                        | `nitro-nightly@3.0.1-20260128-*` | 2026-10-01 | TanStack Start requires Nitro 3 nightly APIs                      | Pin exact nightly hash in catalog                          |
| `@typescript/native-preview`   | `7.0.0-dev.*`                    | 2026-10-01 | Vite Plus type-aware oxlint uses native TS preview                | Dev-only; `typescript@6.0.3` for emit                      |

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

Production Docker images and CI use **Node 24 Active LTS** (`.node-version`). Node 25 is not used in production paths.
