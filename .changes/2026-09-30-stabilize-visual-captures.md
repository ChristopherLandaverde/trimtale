# Stabilize visual captures

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/12-form-candidate-highlight-snapshot-flake.md`

## Summary

Stabilized two existing browser captures without changing or replacing their approved
images.

## Why

The full verification gate consistently reproduced a negligible full-page
rasterization difference and a clipped element capture caused by its parent test
surface being narrower than the explicit element width.

## Behavior

Product behavior and approved visual baselines are unchanged. Test-only capture setup
now gives the agent-task surface enough parent width, its tolerance remains bounded to
20 pixels, and the paired full-page highlight captures accept at most 100 differing
pixels out of more than 900,000.

## Regression coverage

The existing conversation-intake and enhanced-measurement Playwright journeys remain
the regression contracts. Both must pass repeated fresh-profile runs without baseline
replacement.

## Verification

- Repeated focused Playwright runs — 10 passed across five fresh profiles per case.
- `npm run verify` — 483 deterministic tests and 95 Chromium journeys passed.
- `npm run check:change-docs -- --base 0a97e5724988ab22f494e249e4de18bbc5a6949c`
  — 108 change records valid.

## Exploratory review

Expected, actual, and diff artifacts were visually inspected before implementation.
The mismatches were limited to rasterization noise and parent-surface clipping; no
product visual change was observed. No baseline was updated.

## Documentation

Reopened and updated the existing snapshot-stability issue with the reproduced gate
evidence, implementation scope, and authorization.
