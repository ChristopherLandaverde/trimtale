# Remove the customer Evidence path

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/39-remove-customer-evidence-path.md`

## Summary

Remove the eight-stage Evidence path card from the website agent while retaining
concise task receipts and verification results.

## Why

The card duplicates connected context, task progress, and final evidence while adding
internal implementation detail to the customer's workflow.

## Behavior

Customers continue to see connected GTM/GA4 context, page highlights, task receipts,
review actions, and browser/platform results. Structured evidence, privacy filtering,
verification, exact-draft binding, and provider checks remain unchanged. No demo-only
UI branch or authority change is introduced.

## Regression coverage

Updated permanent Chromium contracts prove the card and its stage labels are absent
while navigation artifacts, page markers, browser results, platform confirmation,
safe provider failure, retry behavior, and privacy boundaries remain available. The
obsolete Evidence path baselines were removed and replaced with confirmed-navigation
and connected-result baselines.

## Verification

`npm run verify` passed 404 deterministic tests and 61 Playwright Chromium journeys.
All builds, typechecks, preflight checks, and 71 change records passed.

## Exploratory review

[`docs/reviews/2026-08-25-remove-customer-evidence-path.md`](../docs/reviews/2026-08-25-remove-customer-evidence-path.md)
records successful confirmation, provider-denied, and attacker-shaped page-text
scenarios. No blocker or high-severity finding remains.

## Documentation

Updated the conversational specification, capabilities, connected-evidence issue,
implementation issue, managed-workspace guide, and Stage 1 handoff. Retired the
presentation-only `Evidence path` glossary term while retaining authoritative `Run
evidence`. No ADR is needed because no architectural contract changed.
