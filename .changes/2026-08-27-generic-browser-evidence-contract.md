# Define generic browser evidence

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/25-generic-browser-evidence-contract.md`

## Summary

Defined the versioned browser evidence contract and executable acceptance cases that
will let one deterministic evaluator classify form and known-interaction evidence.

## Why

Event-specific verdict branches cannot scale across tracking setups without drifting
on duplicate handling, consent, required parameters, or privacy boundaries.

## Behavior

This is a specification slice. It records contract fields, evaluation precedence,
automatic-event handling, migration parity, and non-goals. It does not change runtime
evidence collection, verdicts, browser UI, GTM, or GA4 behavior.

## Regression coverage

`packages/core/src/browser-evidence-acceptance.test.ts` validates the shared fixture
for lead forms, navigation, downloads, and phone clicks, including automatic events,
duplicates, missing parameters, consent limits, absent outcomes, and negative
expectations. The future evaluator must consume this same fixture.

## Verification

- Focused acceptance test: 3 tests passed.
- `npm run verify`: 424 deterministic tests and 75 Chromium journeys passed.

## Exploratory review

Not applicable. This slice changes specification and executable acceptance data only;
the built product is unchanged.

## Documentation

Updated Issue 25, the active setup-engine specification, the domain glossary, and ADR
0004.
