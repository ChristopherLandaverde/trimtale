# Extract E2E workflow fixtures

Status: resolved

## Problem

`tests/e2e/navigation-extension.spec.ts` contains large inline operation builders and
workflow route mocks. This makes the already-important Phase 1 browser tests harder
to extend before real Google testing.

## Regression Contract

- Move navigation/form operation builders and writable workflow route mocks to a
  reusable helper module.
- Preserve all current route behavior and default fixture data.
- Run `npx playwright test tests/e2e/navigation-extension.spec.ts`.
- Run `npm run verify` before resolving.

## Acceptance Criteria

- [x] The E2E spec reads primarily as practitioner journeys.
- [x] The helper supports navigation and lead-form workflow operations.
- [x] Browser verification and rollback tests still assert exact evidence/approval
      payloads.

## Comments

- 2026-08-31: Extracted navigation/form operation builders and writable workflow
  route mocks to `tests/e2e/helpers/workflow-fixtures.ts`. `npm run check` passed.
  `npx playwright test tests/e2e/navigation-extension.spec.ts` passed: 17 tests.
  `npm run verify` passed: 271 unit/domain tests and 45 Playwright E2E tests.
