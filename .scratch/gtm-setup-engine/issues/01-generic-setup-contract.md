# Generic setup contract and firing policy

Delivery mode: implementation
Status: resolved

## Production outcome

One versioned contract represents open analytics event names, parameter mappings, GTM
tag actions, trigger sources, conditions, exclusions, consent requirements, and
verification expectations without event-specific runtime branches.

## Non-goals

- Generating or applying GTM entities.
- Selecting a production language model.
- Adding new visible event workflows.

## Authorization

The user explicitly authorized this coding slice on 2026-08-24.

## Regression contract

- `packages/core/src/setup-contract.test.ts` covers valid and malformed values at
  every contract boundary.
- `tests/fixtures/tracking-setups-v1.json` supplies navigation, lead form, page-scope,
  phone-click, and custom-data-layer examples that validate through the same contract.
- The contract test supplies a new event name and template identifier as data without
  changing a closed union.

## Dependencies

None.

## Resolution

- `packages/core/src/setup-contract.ts` exports the versioned contract and runtime
  validator from the shared core package.
- The five acceptance fixtures and 24 focused tests pass in the ordinary unit harness.
- `npm run verify` passes 314 unit tests and 51 Playwright Chromium journeys.
- No current generator, provider mutation, or visible workflow changed.
