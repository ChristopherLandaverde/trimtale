# Extract workflow bridge contracts

Change record version: 2

Issue: `.scratch/phase-1-refactor-scope/issues/03-workflow-bridge-contracts.md`

## Summary

Moved extension workflow action names, request/response/result types, and
stored-operation mapping into a shared bridge module used by both the content script
and service worker.

## Why

This reduces duplicated Phase 1 workflow contracts before real Google testing and
makes future terminal state changes easier to verify in one place.

## Behavior

No message names, local API endpoints, or user-visible workflow behavior are intended
to change. Unsupported stored operation states still fail closed as blocked results.

## Regression coverage

Added `apps/extension/src/workflow-bridge.test.ts` covering published, completed,
rollback-required, rolled-back, resumable stored states, and unsupported states.

## Verification

- `npm run check` passed.
- `npm test -- apps/extension/src/workflow-bridge.test.ts apps/extension/src/setup-operation-presenter.test.ts` passed.
- `npm run build --workspace @gtm-observability/extension` passed.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed: 17/17.
- `npm run verify` passed: preflight, change docs, typecheck, 288 Vitest tests,
  and 45 Playwright E2E tests.

## Exploratory review

Not applicable: this is an internal contract refactor with no intended user-visible
behavior change. Existing browser E2E remains the exploratory safety net for the
affected assistant workflow.

## Documentation

Updated `.scratch/phase-1-refactor-scope/spec.md` and resolved
`.scratch/phase-1-refactor-scope/issues/03-workflow-bridge-contracts.md`.
