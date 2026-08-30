# Discover one adjacent form success status

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/21-discover-adjacent-form-success.md`

## Summary

The form scanner can now propose one stable status/live region from the form's nearest
semantic section as visible success evidence. The live ConsentFlow disposable form
therefore advances to a reviewable `generate_lead` draft instead of an unnecessary
diagnostic handoff.

## Why

The page already exposed an explicit `#workflow-smoke-success` element with
`role=status`, but discovery recognized only manual dataset annotations. Users should
not have to diagnose missing instrumentation metadata when the page offers one safe,
unambiguous observable outcome.

## Behavior and safety

- Explicit `data-success-selector` and `data-success-url` metadata retain precedence.
- Fallback discovery stays inside the nearest `section`, `article`, or named region.
- Exactly one ID-addressable `role=status` or active `aria-live` element is required.
- Zero, multiple, and ID-less candidates remain unresolved and preserve the diagnostic
  handoff rather than guessing.
- Status text and form values are not retained or sent to the assistant backend.
- Discovered evidence still requires specification review and confirmation; it proves
  neither form success nor analytics/platform receipt by itself.

## Regression coverage

The built-extension regression starts red on the live-equivalent verification target,
then covers the successful unique-status path plus multiple-status and ID-less negative
paths. Existing form journeys continue to cover explicit metadata precedence.

## Verification

- Focused built-extension journey: 1 passed, covering one positive and two negative
  pages.
- `npm run verify` passed local preflight, 35 change records, every build and strict
  check, 264 deterministic tests across 37 files, and all 28 Chromium journeys.
- Exact-base documentation and GitHub Verify results remain merge gates.
- No credential, provider call, GTM write, form submission, or publication is required.

## Exploratory review

A headed production-extension build was opened on the live ConsentFlow page. The same
user prompt now receives a concise `generate_lead` interpretation and **Review setup**
action. The form was not submitted during this review; it exercised discovery and
conversation rendering only.

## Documentation

The accepted specification, intake interpretation contract, current capabilities, and
issue 21 define the scoped discovery rule, ambiguity behavior, authority boundary, and
privacy constraints.

## Rollback

Revert this change to restore dataset-only success discovery. Existing explicit form
metadata and all backend/GTM boundaries remain independently reversible.
