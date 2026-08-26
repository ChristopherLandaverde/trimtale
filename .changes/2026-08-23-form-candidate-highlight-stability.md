# Stabilize form-candidate highlight screenshots

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/12-form-candidate-highlight-snapshot-flake.md`

## Summary

The conversation-intake journey now installs its existing screenshot-only typography
normalization inside the candidate-highlight shadow root before visual measurement.
Its two page-highlight snapshots exclude the independently moving assistant shell.

## Why

The full-page contract coupled target highlighting to assistant scrolling and shell
geometry. The confirmed screenshot moved by 13,911 pixels after unrelated workbench
changes, and fresh profiles later exposed a separate one-pixel shell drift even though
the target highlights were unchanged.

## Behavior

The deterministic fixture document remains normalized before interaction. Candidate
labels are additionally normalized inside their open shadow root, and the journey
asserts the expected Arial test font. The assistant is hidden only during the two page
captures, then restored for the existing workflow assertions. The production extension,
assistant styling, and product workflow are unchanged.

## Regression coverage

`tests/e2e/conversation-intake.spec.ts` makes pre-capture candidate-label typography an
explicit invariant and isolates the candidate and confirmed highlight baselines from
assistant rendering. Both baselines were intentionally replaced to show the complete
page targets without the assistant occluding the newsletter form. The narrowed contract
passed ten consecutive fresh-profile repetitions. Two element-level Enhanced
Measurement visuals retain their approved 348px capture width explicitly; their
baselines were not replaced.

## Verification

The reopened highlight contract passed ten consecutive fresh-profile runs after
isolation. The two width-stabilized element contracts passed 20 consecutive focused
cases. Final `npm run verify` passed change-document validation, strict TypeScript,
all 392 deterministic tests, all builds, and all 55 Chromium journeys.

## Exploratory review

This changes screenshot-only test behavior and does not alter the built extension.
The intentional baseline replacement is reviewed in
`docs/reviews/2026-08-25-form-highlight-visual-isolation.md`.

## Documentation

Issue 12 records the historical CI evidence, the coupled visual surfaces, and repeated
verification. No domain language or product specification changed.
