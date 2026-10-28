# Define generic browser evidence

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/25-generic-browser-evidence-contract.md`

## Summary

Implemented the versioned browser evidence contract and one deterministic evaluator
for form, navigation, download, and phone-click evidence.

## Why

Event-specific verdict branches cannot scale across tracking setups without drifting
on duplicate handling, consent, required parameters, or privacy boundaries.

## Behavior

Tracking setup authors now store a versioned browser-evidence contract. Form,
navigation, download, and phone-click runtime paths evaluate normalized observations
through the same rules for required outcomes, matching event requests, required
parameters, duplicates, consent, and negative expectations. Automatic GA4 events
cannot satisfy or duplicate the expected event. Existing verdict codes, privacy
filtering, browser UI, and the unverified GA4 platform boundary remain unchanged.

## Regression coverage

`packages/core/src/browser-evidence.test.ts` consumes the shared acceptance fixture for
lead forms, navigation, downloads, and phone clicks. Existing form, navigation,
setup-contract, adapter, and interaction-authoring suites prove migration parity and
schema/reference validation.

## Verification

- Focused production and migration suites: 78 tests passed.
- `npm run check`: all workspace builds and typechecks passed.
- `npm run verify`: 436 deterministic tests and 75 Chromium journeys passed.

## Exploratory review

[Issue 25 runtime review](../docs/reviews/2026-08-27-generic-browser-evidence-runtime.md)
covered exact form evidence, provider-read denial, phone-click authoring and exact
verification, navigation setup, and inert attacker-controlled labels. All 12 focused
Chromium journeys passed with no finding.

## Documentation

Updated Issue 25, its executable acceptance fixture, setup fixtures, the domain
glossary, ADR 0004, and the runtime exploratory review.
