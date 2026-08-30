# Assistant resume and blocked operation states

Change record version: 2

Issue: `.scratch/assistant-setup-operation/issues/03-resume-operation-from-assistant.md`

## Summary

The assistant now preserves stored operation status when reading durable workflow
state, renders partial resume and validation-blocked guidance, and replaces stale
operation cards after resume.

## Why

This hardens the approval-bound setup workflow so interrupted GTM writes can continue
from durable backend state without implying publication or leaving duplicate controls.

## Behavior

Stored operations are mapped to versioned, paused, or blocked assistant states based
on the operation status. Partial application shows a resume action with bounded
guidance. Validation failures render as blocked and keep immutable version evidence
withheld. Rendering a newer operation state removes the previous operation card.

Publication remains out of scope and is still not available from the assistant.

## Regression coverage

Updated `tests/e2e/navigation-extension.spec.ts` with deterministic extension E2E
coverage for partial application resume, duplicate operation-card prevention,
validation-blocked guidance, no version evidence on validation failure, and no
platform-confirmed claim.

## Verification

Verification completed on 2026-08-30:

- `npm run check` passed.
- `npx playwright test tests/e2e/navigation-extension.spec.ts -g "resumes a partial|renders blocked validation"` passed with 2 tests.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed with 10 tests.
- `npm run verify` passed: preflight, change-doc validation, strict TypeScript,
  264 unit/domain tests, and 38 Chromium E2E tests.

## Exploratory review

See `docs/reviews/2026-08-30-assistant-resume-blocked-operation.md`. The review covers
partial application resume, validation-blocked guidance, existing happy paths, the
negative missing-measurement path, and adversarial page-label safety. No blocker or
high-severity findings remain for this slice.

## Documentation

Updated `.scratch/assistant-setup-operation/spec.md`, related local issue notes, and
`docs/product-plan/current-capabilities.md` to describe resume behavior, blocked
validation guidance, and remaining blocked-state coverage.
