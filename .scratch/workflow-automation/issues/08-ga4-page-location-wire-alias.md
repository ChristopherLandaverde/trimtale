# Accept GA4's standard page-location wire parameter

Status: resolved

## Objective

Treat GA4's standard `dl` transport parameter as evidence for the required
`page_location` event field, while retaining support for the existing
`ep.page_location` custom-parameter representation and the evidence privacy boundary.

## Regression contract

`packages/core/src/form-verdict.test.ts` must prove that a single `generate_lead`
request passes with either `dl` or `ep.page_location`, and still returns
`missing_parameter` when both are absent. `packages/core/src/form-evidence.test.ts`
must prove that normalization retains a query-redacted `dl` location while continuing
to discard non-allowlisted parameters and private values.

## Comments

- 2026-08-23: Claimed after the live disposable-container smoke emitted one correct
  `generate_lead` request with `form_id`, `form_name`, and GA4's standard `dl` field.
  The current verdict falsely required `ep.page_location`; the published GTM tag and
  live page URL were correct.
- 2026-08-23: Focused regression tests passed, followed by the complete `npm run
  verify` gate: 197 deterministic tests across 29 files and all 25 Chromium workflows.
  A corrected credentialed Chromium smoke observed one exact request and no duplicate.

## Answer

The evidence normalizer now safely retains query-redacted `dl` locations, and the
verdict accepts either `dl` or `ep.page_location` for the semantic `page_location`
requirement. Missing both representations still fails as `missing_parameter`.
