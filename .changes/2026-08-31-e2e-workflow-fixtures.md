# E2E workflow fixtures

Change record version: 2

Issue: `.scratch/phase-1-refactor-scope/issues/01-e2e-workflow-fixtures.md`

## Summary

Extracted the Phase 1 E2E workflow operation builders and writable workflow route
mocks from `tests/e2e/navigation-extension.spec.ts` into
`tests/e2e/helpers/workflow-fixtures.ts`.

## Why

This reduces test-file density before real Google testing and gives future
refactors a reusable harness for navigation, lead-form, publication, browser
verification, and rollback journeys.

## Behavior

No product behavior changed. The same mocked workflow routes, operation states,
evidence callbacks, publication failures, browser-verification responses, and
rollback responses remain available to the E2E tests.

## Regression coverage

The existing navigation extension E2E suite continues to cover the full Phase 1
assistant workflow, including post-publication browser verification and rollback
approval payload assertions.

## Verification

- `npm run check` passed.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed: 17 tests.
- `npm run verify` passed: preflight, change-doc validation, typecheck, 271 unit/domain tests, and 45 Playwright E2E tests.

## Exploratory review

No separate exploratory review is required because this is a test-harness-only
refactor with no user-visible behavior change. The browser E2E suite exercises the
same visible assistant journeys as before.

## Documentation

Updated `.scratch/phase-1-refactor-scope/spec.md` and
`.scratch/phase-1-refactor-scope/issues/01-e2e-workflow-fixtures.md`.
