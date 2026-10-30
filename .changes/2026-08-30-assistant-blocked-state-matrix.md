# Assistant blocked-state follow-up matrix

Change record version: 2

Issue: `.scratch/assistant-setup-operation/issues/02-operation-timeline-ui.md`

## Summary

The assistant setup operation now covers the remaining deterministic blocked states
for workspace inspection, resume, validation, and publication failure with bounded
guidance and no premature proof claims.

## Why

This makes the workflow resilient enough to continue toward post-publication browser
verification without leaving unsafe or ambiguous GTM states hidden from the
practitioner.

## Behavior

Workspace capacity, ownership, and synchronization blocks withhold operation-start
actions. Resume responses for stale workspace, stale plan, ownership conflict,
synchronization conflict, and inaccessible container render blocked operation guidance.
Publication failures remain bounded and do not advance browser verification or platform
confirmation. Failed Google publication no longer persists a half-approved operation.

## Regression coverage

Updated `apps/api/src/workflow-runner.test.ts` to prove failed publication preserves
the versioned operation state. Updated `tests/e2e/navigation-extension.spec.ts` with
workspace blocked-state, resume blocked-state, and publication failure coverage.

## Verification

Verification completed on 2026-08-30:

- `npm run check` passed.
- `npx vitest run apps/api/src/workflow-runner.test.ts` passed with 8 tests.
- `npm run build && npx playwright test tests/e2e/navigation-extension.spec.ts`
  passed with 14 tests.
- `npm run verify` passed: preflight, change-doc validation, strict TypeScript,
  267 unit/domain tests, and 42 Chromium E2E tests.

## Exploratory review

See `docs/reviews/2026-08-30-assistant-blocked-state-matrix.md`. The review covers
workspace inspection blocks, resume blocks, publication block, existing happy paths,
and adversarial target-label safety. No blocker or high-severity findings remain for
this slice.

## Documentation

Updated `.scratch/assistant-setup-operation/spec.md`, local issue notes, and
`docs/product-plan/current-capabilities.md` to mark the deterministic blocked-state
matrix complete for the setup-operation workflow.
