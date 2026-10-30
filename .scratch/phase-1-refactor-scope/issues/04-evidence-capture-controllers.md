# Extract evidence capture controllers

Status: resolved

## Problem

Navigation click capture, service-worker request enrichment, form evidence
normalization, and post-publication operation recording are currently interleaved in
the content script. This makes timing and privacy boundaries harder to reason about.

## Regression Contract

- Extract navigation and form post-publication controllers without changing evidence
  semantics.
- Keep browser evidence privacy-filtered through existing core normalization.
- Run post-publication navigation and lead-form E2E.
- Run `npm run verify` before resolving.

## Acceptance Criteria

- [x] Navigation post-publication evidence records only after a matching request is
      observed or the existing failure policy applies.
- [x] Lead-form post-publication evidence continues to exclude private form values.
- [x] Duplicate/missing request verdict behavior remains unchanged.

## Resolution Notes

- Added `apps/extension/src/evidence-capture.ts` with navigation and form evidence
  controllers for post-publication active state, verification scope, evidence
  completion, and sanitized form run evidence construction.
- Updated `apps/extension/src/content-script.ts` so click, submit, runtime evidence,
  and form analytics request handlers delegate evidence state to the controllers.
- Added `apps/extension/src/evidence-capture.test.ts` for navigation completion,
  out-of-scope evidence, private form value exclusion, and post-publication form
  completion.
