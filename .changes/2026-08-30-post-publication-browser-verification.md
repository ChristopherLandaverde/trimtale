# Post-publication browser verification

Change record version: 2

Issue: `.scratch/post-publication-browser-verification/spec.md`

## Summary

Published tracking setup operations can now accept schema-validated browser evidence and advance to either `completed` or `rollback_required`. The extension exposes a post-publication verification action and records navigation/form browser evidence through the local workflow API without claiming platform confirmation.

## Why

This moves the product from “published, now pending” to a durable proof step that confirms whether the expected browser-to-Google collection request was observed after publication.

## Behavior

The backend adds a browser-verification recording route for published operations only. Passing `browser_verified` evidence marks the operation completed with platform confirmation unavailable; failed evidence marks rollback required and preserves the prior live version fingerprint. The assistant renders **Start browser verification** only after publication, records evidence after the confirmed interaction, reloads completed/rollback-required states, and labels platform confirmation as unavailable.

Rollback approval, GA4 reporting receipt, Google Ads confirmation, and autonomous monitoring remain out of scope.

## Regression coverage

- `apps/api/src/workflow-runner.test.ts` covers completed and rollback-required post-publication transitions, pre-publication rejection, and wrong-specification rejection.
- `tests/e2e/navigation-extension.spec.ts` covers the published navigation assistant flow, observed browser evidence posting, and `platformConfirmation: "unverified"`.

## Verification

- `npm run check` passed.
- `npm test -- apps/api/src/workflow-runner.test.ts tests/e2e/navigation-extension.spec.ts` passed for the workflow-runner unit file.
- `npm run test:e2e` passed: 43 Playwright tests.
- `npm run verify` passed: preflight, change-doc validation, typecheck, 270 unit/domain tests, and 43 Playwright E2E tests.

## Exploratory review

See `docs/reviews/2026-08-30-post-publication-browser-verification.md`.

## Documentation

Updated `.scratch/post-publication-browser-verification/spec.md` and `docs/product-plan/current-capabilities.md`.
