# Extract evidence capture controllers

Change record version: 2

Issue: `.scratch/phase-1-refactor-scope/issues/04-evidence-capture-controllers.md`

## Summary

Extracted navigation and form evidence capture state from the content script into
dedicated extension controllers.

## Why

This reduces timing and privacy risk in the post-publication browser verification
flow before real Google testing.

## Behavior

No evidence semantics are intended to change. Navigation post-publication completion
continues to depend on the existing browser evidence flow, and lead-form evidence
continues to pass through the core privacy-filtering normalizer.

## Regression coverage

Added `apps/extension/src/evidence-capture.test.ts` for navigation completion,
ignored out-of-scope evidence, private form value filtering, and active
post-publication form completion.

## Verification

- `npm run check` passed.
- `npm test -- apps/extension/src/evidence-capture.test.ts` passed.
- `npm run build --workspace @gtm-observability/extension` passed.
- `npm test -- apps/extension/src/evidence-capture.test.ts apps/extension/src/workflow-bridge.test.ts apps/extension/src/setup-operation-presenter.test.ts` passed.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed: 17/17.
- `npm run verify` passed: preflight, change docs, typecheck, 292 Vitest tests,
  and 45 Playwright E2E tests.

## Exploratory review

Not applicable: this is an internal controller extraction with no intended
user-visible behavior change. Existing post-publication navigation and lead-form E2E
cover the affected assistant workflow.

## Documentation

Updated `.scratch/phase-1-refactor-scope/spec.md` and resolved
`.scratch/phase-1-refactor-scope/issues/04-evidence-capture-controllers.md`.
