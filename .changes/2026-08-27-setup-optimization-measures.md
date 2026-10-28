# Establish setup optimization measures

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/28-setup-optimization-measures.md`

## Summary

Defined eight privacy-safe optimization measure families and recorded a five-run local
baseline for four representative workflows.

## Why

Setup speed cannot be improved responsibly without measuring reliability, provider
authority cost, recovery, clarification, and required human work alongside elapsed
time.

## Behavior

This is a discovery slice. It adds no product telemetry, provider calls, latency
targets, performance gates, or user-visible behavior. Local proxy durations remain
separate from true product timing and credentialed Google latency.

## Regression coverage

`packages/core/src/setup-measures-acceptance.test.ts` validates each measure's start,
terminal, unit, aggregation, sample stratum, privacy exclusions, distribution shape,
and unavailable-provider labels.

## Verification

- Five repetitions of four Chromium journeys: 20 passed.
- Focused acceptance test: 4 tests passed.
- `npm run verify`: 432 deterministic tests and 75 Chromium journeys passed.

## Exploratory review

The non-visual discovery evidence and privacy review are recorded in
`docs/reviews/2026-08-27-setup-optimization-baseline.md`. No blocker or high-severity
finding remains.

## Documentation

Updated Issue 28 and the active setup-engine specification with measurement rules,
aggregate baselines, limitations, and the instrumentation boundary.
