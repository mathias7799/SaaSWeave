---
name: feature-plan
description: Plan new SaaSWeave platform features end-to-end before coding — data model, core contracts, API, cache, jobs, auth, feature flags, i18n, console UI, admin, tests, and validation. Use when the user asks for a feature plan, implementation plan, backlog item design, or "how should we build X" for this monorepo.
---

# Feature Plan (SaaSWeave)

Produce a **plan only** unless the user explicitly asks to implement. A plan must
account for every cross-cutting surface the feature touches, not just API + UI.

The durable reference for all of this is
[Building a feature end-to-end](references/feature-building.md); this file is the
procedure that drives it.

## Before planning

1. Read [end-to-end-features.md](../../end-to-end-features.md) and skim [Building a feature end-to-end](references/feature-building.md).
2. Scan existing capabilities in `packages/core/src/features/types.ts` (`DEFAULT_FEATURES`, `PLANNED_FEATURES`); reuse a similar shipped feature.
3. Grep the codebase for an existing partial implementation before designing from scratch.

## Produce the plan

Work the reference in order:

1. **Scope** the feature: user outcome, auth path, tenant scope, feature flag, plan gating. See [Scope questions](references/feature-building.md#scope-questions).
2. **Fill the cross-cutting matrix** - mark every concern Yes/No/N/A with the concrete repo pattern. See [the concern matrix](references/feature-building.md#cross-cutting-concern-matrix).
3. **Design layer by layer** following [the implementation order](references/feature-building.md#implementation-order).
4. **Write** the plan to `docs/plans/<feature-slug>.md` using [the plan template](references/feature-building.md#plan-template), or deliver it in chat if the user only wants a draft.
5. **Check** it against [the quality bar](references/feature-building.md#quality-bar) before proposing the feature for `DEFAULT_FEATURES`.

Name the closest [template feature to copy](references/feature-building.md#similar-feature-shortcuts) and avoid the [anti-patterns](references/feature-building.md#anti-patterns).

## Related

- [Redis, queues, and caching](../redis-workers-cache/references/redis-cache-jobs.md) for cache, job, and retention decisions.
- [Workflow](../../workflow.md) for the validation commands to cite in each phase.
