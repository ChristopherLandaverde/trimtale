# Assistant approval-gated publish

Change record version: 2

Issue: `.scratch/assistant-setup-operation/issues/05-approval-gated-publish.md`

## Summary

The assistant can now publish a versioned GTM setup operation only through an exact
immutable-version fingerprint approval flow, then render publication separately from
browser verification and platform confirmation.

## Why

This advances the core workflow from prepared immutable version to controlled
publication while preserving the evidence boundaries that keep tracking proof credible.

## Behavior

The backend workflow runner now supports `approveAndPublish`, which blocks non-versioned
operations and fingerprint mismatches before calling Google publication. The API exposes
`POST /api/google/workflows/:id/publish` with `versionFingerprint` and `approvedBy`.
The extension bridge calls that route only from the versioned operation card, and the
assistant shows `Publish <fingerprint>` using the durable operation fingerprint.

After publication, the operation timeline marks approval and publication complete while
browser verification and platform confirmation remain pending.

## Regression coverage

Added workflow-runner unit coverage for exact fingerprint publication, fingerprint
mismatch, and repeated publication blocking before duplicate Google publish calls.
Added extension E2E coverage for publishing from a versioned operation card and keeping
browser/platform proof pending.

## Verification

Verification completed on 2026-08-30:

- `npm run check` passed.
- `npx vitest run apps/api/src/workflow-runner.test.ts` passed with 7 tests.
- `npx playwright test tests/e2e/navigation-extension.spec.ts -g "publishes only"` passed with 1 test.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed with 11 tests.
- `npm run verify` passed: preflight, change-doc validation, strict TypeScript,
  266 unit/domain tests, and 39 Chromium E2E tests.

## Exploratory review

See `docs/reviews/2026-08-30-assistant-approval-publish.md`. The review covers exact
fingerprint publication, backend approval guards, existing negative states, and
adversarial page-label safety. No blocker or high-severity findings remain for this
slice.

## Documentation

Updated `.scratch/assistant-setup-operation/spec.md`,
`.scratch/assistant-setup-operation/issues/05-approval-gated-publish.md`, and
`docs/product-plan/current-capabilities.md` to describe the approval-gated publish
boundary and remaining post-publication proof work.
