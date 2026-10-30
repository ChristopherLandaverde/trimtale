# Rollback approval flow

Change record version: 2

Issue: `.scratch/post-publication-browser-verification/spec.md`

## Summary

Rollback-required setup operations can now be explicitly approved from the website assistant and restored through the backend's fingerprint-guarded rollback path.

## Why

This completes the Phase 1 recovery path: failed post-publication browser verification is no longer only a warning state; it can return the GTM container to the recorded prior live version after exact target approval.

## Behavior

The workflow runner now accepts rollback approval only for `rollback_required` operations and only when the requested target fingerprint matches the recorded rollback target. The API exposes `POST /api/google/workflows/:id/rollback`. The extension renders **Rollback live-7** only from rollback-required operation cards, submits the target fingerprint and approver, and renders the final `rolled_back` state after success.

Autonomous rollback, platform confirmation, and rollback from non-failed operations remain out of scope.

## Regression coverage

- `apps/api/src/workflow-runner.test.ts` covers exact rollback target approval, mismatch blocking, persistence as `rolled_back`, and no Google rollback call on mismatch.
- `tests/e2e/navigation-extension.spec.ts` covers the visible failed-publication recovery path and exact rollback approval payload from the assistant.

## Verification

- `npm run check` passed.
- `npm test -- apps/api/src/workflow-runner.test.ts` passed: 12 tests.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed: 17 tests.
- `npm run verify` passed: preflight, change-doc validation, typecheck, 271 unit/domain tests, and 45 Playwright E2E tests.

## Exploratory review

See `docs/reviews/2026-08-30-rollback-approval-flow.md`.

## Documentation

Updated `docs/product-plan/current-capabilities.md`.
