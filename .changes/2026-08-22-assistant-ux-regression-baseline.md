# Protect the existing assistant UX baseline

Issue: `.scratch/conversational-tracking-specs/issues/10-assistant-ux-baseline.md`

## Summary

Added visual, focus, and accessible-interaction regression coverage for the current floating tracking assistant before conversational form behavior changes it.

## Why

Future conversation work must make intentional UX changes visible without silently reversing the accepted navigation experience.

## Behavior

Product behavior is unchanged. The harness now protects collapsed, open, navigation-scope, and evidence-path states and verifies that opening the assistant focuses the composer.

## Regression coverage

The existing Chromium extension journey captures committed assistant-locator screenshots with animations disabled. Existing role/name assertions remain the interaction contract, and collapse persistence remains covered across reload.

Linux CI and the local Linux host rasterize identical system-font glyphs differently. Visual comparison permits at most a 2% differing-pixel ratio; layout, accessible text, focus, and state assertions remain exact.

## Verification

`npm run verify` passes with change-document validation, strict TypeScript checks, 22 unit/scenario/acceptance-contract tests, all builds, four visual comparisons, and the Chromium extension E2E journey.

## Documentation

Added issue 10 and documented the intentional snapshot-update procedure in the delivery harness.
