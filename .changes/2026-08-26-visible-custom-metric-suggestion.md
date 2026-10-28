# Show a bounded custom metric suggestion

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/07-ga4-configuration.md`

## Summary

Render model-authored parameter classifications in practitioner language and expose
one representative event-scoped GA4 custom-metric suggestion in the visible review.

## Why

The authoring contract distinguished parameters needing GA4 custom definitions, but
the website agent displayed the internal enum token and did not prove the custom-metric
case.

## Behavior

The review now labels suggestion classes in plain language. A numeric `lead_score`
suggestion can explain that an event-scoped GA4 custom metric is required. When no
numeric value source is grounded, the suggestion stays visible but does not enter the
approved GTM setup and does not create a GA4 action. Existing explicit GA4 approval,
fresh-state checks, and custom-metric writer support are unchanged. Invented values,
implicit provider writes, reporting, attribution, and real-provider execution remain
out of scope.

## Regression coverage

`tests/e2e/conversation-intake.spec.ts` proves the readable custom-definition label,
custom-metric rationale, prohibited private parameter, absence of `lead_score` from
durable GTM planning, and exclusion of private and attacker-shaped page values.

## Verification

`npm run verify` passed preflight and documentation checks, all workspace typechecks,
411 deterministic tests across 51 files, all builds, and 70 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-visible-custom-metric-suggestion.md`. Headed Chromium
covered the visible metric and prohibited-parameter rows, approval, and non-application
boundary. No unresolved finding remains.

## Documentation

Updated Issue 07, current capabilities, and the Stage 1 handoff to record the completed
visible custom-metric suggestion and remaining identity/provider boundaries.
