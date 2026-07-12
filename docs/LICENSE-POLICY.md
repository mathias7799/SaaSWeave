# License policy

Last updated: 2026-07-11

## Approved licenses

Production dependency trees must only include packages whose SPDX identifier appears in
[`.github/approved-licenses.json`](../.github/approved-licenses.json). CI runs
`scripts/ci/license-gate.mjs` on every pull request.

## `@paper-design/shaders` (Unknown in `pnpm licenses`)

The hero background uses `@paper-design/shaders-react`, which depends on `@paper-design/shaders`.

| Package                       | Registry license        | pnpm `licenses list` | Decision                                                                                                                                               |
| ----------------------------- | ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@paper-design/shaders`       | Apache-2.0 (`npm view`) | Unknown              | **Accepted** — registry metadata is Apache-2.0; published tarball omits the `license` field. Listed in `approved-licenses.json` documented exceptions. |
| `@paper-design/shaders-react` | Apache-2.0              | Unknown              | Same as above.                                                                                                                                         |

Attribution is included in the generated [`NOTICE`](../NOTICE) file.

## LGPL / MPL dynamic distribution

Some transitive dependencies (for example tooling pulled by dev-only packages) may be
LGPL-2.1+ or MPL-2.0. Engineering policy:

1. **Production runtime images** must not statically bundle LGPL libraries without a
   documented exception and legal review.
2. **MPL-2.0** is allowed when the dependency remains a separate file/module at runtime
   (typical npm `node_modules` layout).
3. All copyleft packages in production trees require a `copyleftAttributions` entry in
   `.github/approved-licenses.json`. NOTICE generation fails when the copyright holder or canonical
   license-text link is missing.

This document is an engineering policy, not legal advice.

## Regenerating NOTICE

```bash
node scripts/ci/generate-notice.mjs
```

Run after dependency changes that affect production packages.

CI regenerates the file and requires a byte-for-byte clean diff. Package ordering and copyleft
attribution metadata are deterministic.
