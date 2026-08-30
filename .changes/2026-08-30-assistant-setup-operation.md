# Assistant setup operation from the website assistant

Change record version: 2

Issue: `.scratch/assistant-setup-operation/issues/01-operation-start-contract.md`

## Summary

The website assistant can now start a durable GTM setup operation for confirmed
navigation-click and lead-form setup requests, render the operation timeline, reload
stored operation state, and stop at immutable version approval.

## Why

This advances the practitioner workflow from downloadable GTM setup and managed
workspace preparation to an approval-bounded version draft without exposing publication
from the assistant.

## Behavior

`Prepare GTM version` appears only after setup generation passes and GTM access
inspection reports one recognized writable container. The extension sends the confirmed
setup payload to the local workflow API, resumes the operation to the versioned state,
stores the operation ID for the setup/container pair, and reads the latest operation
detail when the same setup is reopened.

The assistant displays planning, entity application, validation, immutable version,
and publication approval as separate stages. Publication remains deliberately
unchanged and out of scope.

## Regression coverage

Updated `tests/e2e/navigation-extension.spec.ts` with deterministic extension E2E
coverage for navigation setup operation start, lead-form setup operation start,
approval-bound version evidence, durable reload from stored operation ID, and the
absence of platform-confirmed claims. The managed-workspace Darwin screenshot baseline
was regenerated because the new version-prep action is now intentionally visible.

## Verification

Verification completed on 2026-08-30:

- `npm run check` passed.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed with 8 tests.
- `npm run verify` passed: preflight, change-doc validation, strict TypeScript,
  264 unit/domain tests, and 36 Chromium E2E tests.

## Exploratory review

See `docs/reviews/2026-08-30-assistant-setup-operation.md`. The review covers the
navigation happy path, lead-form happy path, durable reopen/read behavior, one negative
state, and one adversarial page-label state. No blocker or high-severity findings
remain for this slice.

## Documentation

Updated `.scratch/assistant-setup-operation/spec.md`, related local issue files, and
`docs/product-plan/current-capabilities.md` to describe the assistant-start workflow,
approval boundary, durable operation read, and remaining blocked-state/resume work.
