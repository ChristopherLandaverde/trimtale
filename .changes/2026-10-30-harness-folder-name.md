# Stop the agent harness tests depending on the checkout folder name

Change record version: 2

Issue: none (state audit `portfolio-ops/audits/gtm-observability-state.md`, unit-test caveat)

## Summary

`scripts/agent-harness.test.ts` now asserts the exact repository root the harness derives
from its own file location, instead of a `/gtm-observability$/` folder-name pattern.

## Why

The test failed in any git worktree or clone whose folder is not named `gtm-observability`,
even though the harness itself was correct. Agents work from worktrees, and the product is
being renamed, so the folder name will vary.

## Behavior

No product or harness behavior changes. `scripts/agent-harness.mjs` already resolved its
root from `import.meta.url`. The test's commit-message path now resolves from that same
root rather than the process working directory, matching the harness.

## Regression coverage

The four `cwd` assertions are stricter: they compare to the exact root path instead of a
suffix match. Verified by running the suite from a worktree named `trimtale-harness`.

## Verification

From a worktree named `trimtale-harness`: `npm run check` passed, `npx vitest run` passed
40 files / 301 tests, `npm run build` passed, and `npx playwright test` passed 46 tests.

## Exploratory review

Not applicable: test-only change with no user-visible surface.

## Documentation

None needed.
