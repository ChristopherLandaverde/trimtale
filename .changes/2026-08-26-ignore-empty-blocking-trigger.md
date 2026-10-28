# Ignore empty blocking-trigger defaults

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/18-ignore-empty-blocking-trigger-default.md`

## Summary

Treat Google's omitted `blockingTriggerId` field as equivalent to a generated empty
list during GTM entity comparison.

## Why

The authorized Stage 1 review found a false managed replacement conflict whose only
difference was Google's omission of this empty default. Replacing the tag would have
been unnecessary.

## Behavior

A tag with otherwise matching normalized semantics is reused when current Google state
omits `blockingTriggerId` and the generated setup contains `[]`. Non-empty blocking
triggers, ownership checks, identifiers, fingerprints, and all other semantics remain
unchanged.

## Regression coverage

`packages/core/src/change-plan.test.ts` reproduces the provider omission and requires a
ready reuse action. Existing managed replacement tests continue to require approval
for actual semantic differences.

## Verification

`npm run verify` passed preflight, 85 change records, all workspace typechecks, 418
deterministic tests across 51 files, all builds, and 70 Chromium journeys.

## Exploratory review

No new user-visible surface was added. The live exact semantic review exposed the
provider-default mismatch before any Google mutation, and the permanent planner test
captures it.

## Documentation

Recorded the live evidence and resolution in Issue 18 and this change record.
