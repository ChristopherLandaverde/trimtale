# Connect form targets and report observed GTM runtime

Issue: `.scratch/conversational-tracking-specs/issues/11-exploratory-intake-findings.md`

## Summary

Added candidate and confirmed form highlights, safe GTM runtime observation, and explicit evidence boundaries for generation, runtime, browser verification, and platform confirmation.

## Why

The intake UI previously asked practitioners to choose forms without connecting those choices to the page, and its GTM label described generation history rather than observed installation state.

## Behavior

Ambiguous form candidates are highlighted and selection leaves only the confirmed form. Safe script metadata can report a public GTM container ID; successful inspection without a signal reports not detected, and unavailable inspection remains inconclusive. Page-controlled highlight labels are rendered as inert text.

## Regression coverage

Core tests cover detected, absent, and inconclusive runtime observations. Chromium tests cover form candidate/confirmed states, separated evidence language, local detected and absent GTM states, visual baselines, and an adversarial page label that must not create executable markup.

## Verification

`npm run verify` passed with valid change documentation, strict type checks, 42 deterministic tests, all workspace builds, and four Chromium workflows.

## Exploratory review

`docs/reviews/2026-08-22-form-highlights-gtm-runtime.md` records the agent-owned local Chromium review. No blocker or high findings remain.

## Documentation

Resolved issue 11, updated the original intake review, and documented the safe handling of page-controlled highlight labels.
