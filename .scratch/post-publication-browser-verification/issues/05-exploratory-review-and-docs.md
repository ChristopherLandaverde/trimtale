# Review and document post-publication browser verification

Status: resolved

Blocked by: 01, 02, 03, 04

## Objective

Complete the delivery harness requirements for the post-publication browser
verification workflow.

## Regression contract

Before resolving this issue:

- `npm run verify` passes.
- A review under `docs/reviews/` covers one passing path, one rollback-required path,
  and one adversarial page state.
- The review has no unresolved blocker or high-severity findings.
- The `.changes/` record names the spec, issues, behavior change, regression evidence,
  verification evidence, review evidence, risk, and rollback approach.
- Product docs explain that Google collection request evidence is browser-to-Google
  verification, not platform processing confirmation.

## Notes

Do not mark this workflow resolved until browser evidence is connected to durable
operation state and reviewed in Chromium.

## Resolution Notes

- Browser evidence is connected to durable operation state for navigation and
  lead-form post-publication verification.
- Exploratory review is recorded in
  `docs/reviews/2026-08-30-post-publication-browser-verification.md`; it covers a
  passing path, rollback-required behavior, adversarial page-controlled text, and no
  unresolved blocker or high-severity findings.
- Product state and boundary language are documented in
  `docs/product-plan/current-capabilities.md`.
- The original implementation change record is
  `.changes/2026-08-30-post-publication-browser-verification.md`; the privacy
  expansion has its own change record for the added sentinel regressions.
