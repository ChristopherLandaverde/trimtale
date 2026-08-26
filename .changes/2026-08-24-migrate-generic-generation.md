# Migrate setup generation

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/03-migrate-existing-setups.md`

## Summary

Route current navigation and lead-form generation through generic setup adapters and
the shared GTM compiler.

## Why

Existing workflows must become the first consumers of the setup engine instead of
remaining event-specific generation branches.

## Behavior

Navigation and all four supported lead-form success evidence types now create generic
setups before compiling GTM artifacts. Current entry points, visible workflows,
privacy boundaries, managed-workspace behavior, and verification remain unchanged.

## Regression coverage

`packages/core/src/setup-adapters.test.ts` proves both workflows validate and compile
through the generic boundary. Existing generator, planner, API, and browser tests
continue to run without weakened assertions.

## Verification

`npm run verify` passes 326 unit tests and 51 Playwright Chromium journeys.

## Exploratory review

The ordinary Chromium gate exercises the unchanged navigation and lead-form journeys.
No new visible state was introduced, so a separate exploratory review is not needed.

## Documentation

The migration issue and Stage 1 acceptance checklist record the completed foundation.
