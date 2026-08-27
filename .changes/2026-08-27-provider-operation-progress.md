# Define provider operation progress

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/27-provider-operation-progress.md`

## Summary

Defined durable provider stages and a visible progress projection that separates live
requests, display timeouts, restart reconciliation, failures, approval waits, and
completed checkpoints.

## Why

Long Google operations can outlast the website agent's display wait. Treating elapsed
time or reload as failure would encourage duplicate provider mutations.

## Behavior

This is a specification slice. Provider attempts remain part of the existing tracking
setup operation; no job store, API, operation schema, mutation behavior, or website UI
was added. Retry remains locked in every acceptance case where provider state is not
freshly known.

## Regression coverage

`packages/core/src/provider-progress-acceptance.test.ts` validates the shared fixture's
six stages, five visible states, zero-call timeout/reload/duplicate behavior, restart
reconciliation, and malformed or secret-bearing rejection cases.

## Verification

- Focused acceptance test: 4 tests passed.
- `npm run verify`: 428 deterministic tests and 75 Chromium journeys passed.

## Exploratory review

Not applicable. This slice changes specification and executable acceptance data only;
the built product is unchanged.

## Documentation

Updated Issue 27, the active setup-engine specification, the domain glossary, and ADR
0005.
