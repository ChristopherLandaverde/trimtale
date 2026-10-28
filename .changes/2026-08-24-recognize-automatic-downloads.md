# Recognize automatic downloads

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/35-recognize-automatic-downloads.md`

## Summary

Recognized download-tracking language and used the exact GA4 enhanced-measurement
audit to decide whether setup already exists.

## Why

The workbench should not answer `track downloads` as unknown or create duplicate GTM
when one exact stream already measures supported file links.

## Behavior

- Complete automatic coverage reports `Already covered` and recommends browser
  verification later.
- Master-off, download-off, unavailable-audit, and missing-exact-stream states report
  bounded gaps.
- No path generates custom GTM setup.
- Custom download tags and other enhanced-measurement intents remain out of scope.

## Regression coverage

`packages/core/src/conversation.test.ts` covers download language and an unrelated
document phrase. `packages/core/src/agent-turn.test.ts` covers exact coverage, both
disabled states, and the missing-stream boundary.
`tests/e2e/gtm-connection-context.spec.ts` protects the visible covered decision and
absence of GTM-generation actions.

## Verification

Focused core tests, strict workspace checks, and the focused Chromium journey passed.
`npm run verify` passed 290 deterministic tests and 51 Chromium journeys.

## Exploratory review

[Automatic download coverage review](../docs/reviews/2026-08-24-automatic-download-coverage.md)
covered complete, disabled, and attacker-shaped states. No finding remains.

## Documentation

The active specification, issue 35, change record, and exploratory review record the
supported decision and its non-goals.
