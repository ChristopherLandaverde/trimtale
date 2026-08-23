# Stabilize form-candidate highlight screenshots

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/12-form-candidate-highlight-snapshot-flake.md`

## Summary

The conversation-intake journey now installs its existing screenshot-only typography
normalization inside the candidate-highlight shadow root before visual measurement and
capture.

## Why

The first screenshot in a fresh CI Chromium process could render the two candidate
label pills from pre-normalization shadow-root layout, differ by 3,293 pixels, and then
pass unchanged in a fresh-worker retry.

## Behavior

The deterministic fixture document remains normalized before interaction. Candidate
labels are additionally normalized inside their open shadow root before the screenshot,
and the journey asserts the expected Arial test font. The production extension,
assistant styling, accepted screenshot baselines, and product workflow are unchanged.

## Regression coverage

`tests/e2e/conversation-intake.spec.ts` now makes pre-capture candidate-label typography
an explicit invariant. The unchanged candidate and confirmed baselines passed 20
consecutive fresh-profile repetitions and five isolated cold-cache Chromium launches.

## Verification

The focused visual contract passed 25 diagnostic repetitions without a retry or
baseline update. `npm run verify` passed readiness, change-documentation, and strict
TypeScript checks, all 202 deterministic tests across 29 files, every workspace build,
and all 25 Chromium workflows.

## Exploratory review

Not applicable. This changes screenshot-only test normalization and does not alter the
built extension. Expected, actual, and diff images were inspected during diagnosis;
no snapshot was updated.

## Documentation

Issue 12 records the historical CI evidence, ruled-out causes, shadow-root timing gap,
and repeated verification. No domain language or product specification changed.
