# Review and document post-publication browser verification

Status: open

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
