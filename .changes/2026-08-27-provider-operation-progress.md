# Define provider operation progress

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/27-provider-operation-progress.md`

## Summary

Implemented durable provider stages and a visible progress projection that separates live
requests, display timeouts, restart reconciliation, failures, approval waits, and
completed checkpoints.

## Why

Long Google operations can outlast the website agent's display wait. Treating elapsed
time or reload as failure would encourage duplicate provider mutations.

## Behavior

The existing tracking operation now stores one safe provider attempt across planning,
application, validation, versioning, publication, and rollback. A versioned read-only
API projection distinguishes in-flight, reconciling, failed, awaiting-user, and
completed states. The website agent shows exact stage and safe elapsed wording after a
display wait or reload, with no retry action while state is active or uncertain. No
job store, background mutation, parallel provider call, or elapsed-time verdict was
added.

## Regression coverage

The production projection consumes the shared acceptance fixture. Operation and runner
tests cover durable schema validation, atomic persistence, a duplicate live action,
backend-restart reconciliation, and bounded provider failure codes. A Chromium journey
proves the exact validation stage, timeout wording, elapsed-time disclaimer, and absent
retry action.

## Verification

- Focused core and runner tests: 44 tests passed.
- Focused Chromium provider-progress journey: 1 passed.
- `npm run verify`: 442 deterministic tests and 76 Chromium journeys passed.

## Exploratory review

[Provider operation progress review](../docs/reviews/2026-08-27-provider-operation-progress-runtime.md)
covered the long-running validation display, retry lock, successful handoff, duplicate
action, backend restart, and secret-bearing provider failure. No finding remains.

## Documentation

Updated Issue 27, the active setup-engine specification, the domain glossary, ADR 0005,
and the runtime exploratory review.
