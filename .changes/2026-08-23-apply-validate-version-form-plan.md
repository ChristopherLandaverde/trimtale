# Apply, validate, and version a form plan

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/28-apply-validate-version-form-plan.md`

## Summary

Added an exact workbench confirmation that runs the existing durable GTM workflow
through application, validation, and immutable version creation.

## Why

The workbench can review a durable GTM plan but cannot yet execute the existing safe
backend workflow.

## Behavior

- Ready plans offer `Apply, validate & create version`.
- A separate checkpoint names the writes, validation, version creation, and
  no-publication boundary before resume is called.
- The extension sends only the operation ID and renders bounded status, validation,
  and fingerprint evidence.
- Blocked, malformed, and authority-escalating responses fail closed without raw
  provider or operation detail.
- Publication approval, publication, rollback, navigation expansion, and real Google
  mutation remain out of scope.

## Regression coverage

`tests/e2e/conversational-form.spec.ts` proves zero resume calls before confirmation,
one bodyless resume call afterward, bounded version evidence, no publication request,
and rejection of a hostile `published` response. The prior plan-only and invalid-plan
regressions remain intact.

## Verification

- Red: both new journeys timed out waiting for the absent application action.
- Green: the complete seven-test lead-form workflow suite passed.
- Full `npm run verify`: 273 deterministic tests and 43 Chromium journeys passed.

## Exploratory review

[Form application and version review](../docs/reviews/2026-08-23-apply-validate-version-form-plan.md)
found no unresolved blocker or high-severity issue across the confirmation, versioned,
and authority-escalation states.

## Documentation

Updated the current-capabilities inventory, MVP handoff, GTM workflow runbook, issue
28, and the exploratory review.
