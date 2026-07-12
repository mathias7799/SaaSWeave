## Problem

What user, operator, or engineering problem does this solve? Link the issue with `Closes #...` when
applicable.

## Solution

Describe the implementation, important design decisions, package boundaries, and behavior changes.

## Validation

List the exact commands run and their results.

```text
vp check --fix
vp test
```

## Operational impact

- [ ] No database migration
- [ ] No new or changed environment variables
- [ ] No security or privacy impact
- [ ] No queue, cache, storage, email, or scheduled-job impact
- [ ] No deployment or rollback considerations

Explain every unchecked item above.

## UI evidence

For visible changes, include desktop and mobile screenshots or a short recording. Remove this section
when it does not apply.

## Checklist

- [ ] I added or updated behavior-focused tests where practical.
- [ ] I updated documentation and environment templates where required.
- [ ] I did not commit secrets, populated environment files, or generated build/coverage output.
- [ ] I followed the repository's package and browser/server boundaries.
- [ ] My commits follow Conventional Commits.
