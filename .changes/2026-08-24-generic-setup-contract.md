# Add generic tracking setup contract

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/01-generic-setup-contract.md`

## Summary

Add a versioned core contract for open tracking events, GTM template and Custom HTML
actions, parameter and bounded structured template-field mappings, firing policies,
consent, and browser verification expectations.

## Why

New tagging requests need to compose existing GTM primitives as data instead of
requiring a production branch for every event type.

## Behavior

The core package can now validate generic tracking setups and expose the contract to
future authoring and compiler slices. Five fixtures prove unrelated event names use
one schema. Existing navigation and lead-form workflows remain unchanged; generation,
application, model authoring, and publication are out of scope.

## Regression coverage

`packages/core/src/setup-contract.test.ts` validates round trips, open event and
template identifiers, template fields, Custom HTML, malformed nested boundaries,
duplicate identifiers, and broken references. `tests/fixtures/tracking-setups-v1.json`
contains navigation, lead-form, page-scope, phone-click, and custom-data-layer setups.

## Verification

`npx vitest run packages/core/src/setup-contract.test.ts` passes 24 tests. The complete
`npm run verify` gate passes 314 unit tests and 51 Playwright Chromium journeys.

## Exploratory review

Not applicable. This slice adds an internal versioned contract and fixtures without a
user-visible workflow change.

## Documentation

The Stage 1 specification, issue regression contract, and domain glossary describe
the generic setup and firing-policy language.
