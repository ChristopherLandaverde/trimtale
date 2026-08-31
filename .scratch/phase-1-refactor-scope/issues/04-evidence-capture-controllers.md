# Extract evidence capture controllers

Status: proposed

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

- [ ] Navigation post-publication evidence records only after a matching request is
      observed or the existing failure policy applies.
- [ ] Lead-form post-publication evidence continues to exclude private form values.
- [ ] Duplicate/missing request verdict behavior remains unchanged.
