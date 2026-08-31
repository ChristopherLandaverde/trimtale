# Post-publication privacy regressions

Change record version: 2

Issue: `.scratch/post-publication-browser-verification/issues/04-privacy-and-adversarial-coverage.md`

## Summary

Expanded post-publication browser-verification privacy regressions for lead-form
evidence and reconciled the post-publication testing tracker with the already
implemented API, assistant, E2E, and review evidence.

## Why

The real-Google Phase 1 proof is complete, so the next testing workstream needs to
prove the product evidence contract is safe around hostile or private browser input
before it becomes client-facing proof material.

## Behavior

No runtime behavior changed. The evidence-capture tests now prove that token-shaped
values, local/session storage-shaped fields, hostile page URLs, raw browser/network
error strings, attacker collection hosts, unsafe request parameters, and private
page-location query values do not enter persisted form evidence. Non-Google
collection URLs are dropped and produce the bounded `tag_fired_request_missing`
verdict while platform confirmation remains `unverified`.

Platform-confirmation behavior remains unchanged and unavailable in Phase 1.

## Regression coverage

- `apps/extension/src/evidence-capture.test.ts` adds hostile input and non-Google
  collection-host sentinels for post-publication form evidence.
- `.scratch/post-publication-browser-verification/spec.md` now records the accepted
  evidence envelope, platform-confirmation label, and completed privacy acceptance
  criteria.
- The post-publication issue files now name the existing API, core, extension, E2E,
  exploratory-review, and privacy regression evidence.

## Verification

- `npm test -- apps/extension/src/evidence-capture.test.ts` passed: 6 tests.
- `npm run verify` passed: preflight, change-documentation validation, strict
  TypeScript checks, 294 unit/domain tests, and 45 Playwright E2E workflows.

## Exploratory review

Interactive review is not applicable for this slice because it adds internal
regression coverage and tracker reconciliation without changing product UI. Existing
post-publication exploratory evidence remains
`docs/reviews/2026-08-30-post-publication-browser-verification.md`.

## Documentation

Updated `.scratch/post-publication-browser-verification/spec.md` and issues
`01` through `05` to reflect the implemented and newly hardened testing state.
