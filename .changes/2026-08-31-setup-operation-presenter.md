# Extract setup operation presenter

Change record version: 2

Issue: `.scratch/phase-1-refactor-scope/issues/02-setup-operation-presenter.md`

## Summary

Extracted setup-operation presentation into a pure extension module and reduced the
content script to DOM rendering plus action wiring.

## Why

This keeps the Phase 1 local workflow easier to refactor before real Google testing
without weakening the platform-confirmation boundary or rollback action behavior.

## Behavior

No product behavior is intended to change. Platform confirmation remains explicitly
unavailable, browser verification is offered only after publication, and rollback is
offered only when browser verification requires restoring the prior live version.

## Regression coverage

Added `apps/extension/src/setup-operation-presenter.test.ts` for versioned,
published, completed, rollback-required, rolled-back, and paused/blocked presenter
states.

## Verification

- `npm run check` passed.
- `npm test -- apps/extension/src/setup-operation-presenter.test.ts` passed.
- `npm run build --workspace @gtm-observability/extension` passed.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed: 17/17.
- `npm run verify` passed: preflight, change docs, typecheck, 278 Vitest tests,
  and 45 Playwright E2E tests.

## Exploratory review

Not applicable: this is an internal refactor with no intended user-visible behavior
change. Existing browser E2E remains the exploratory safety net for the affected
assistant workflow.

## Documentation

Updated `.scratch/phase-1-refactor-scope/spec.md` and resolved
`.scratch/phase-1-refactor-scope/issues/02-setup-operation-presenter.md`.
