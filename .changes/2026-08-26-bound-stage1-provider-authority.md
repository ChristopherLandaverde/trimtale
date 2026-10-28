# Bound Stage 1 provider authority

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/11-credentialed-stage1-workflow.md`

## Summary

Force Analytics writes off inside the credentialed GTM Stage 1 launcher, even when
the parent environment enabled them for a separate session.

## Why

The Stage 1 smoke is authorized and locked for GTM workspace and publication actions.
Inheriting an unrelated Analytics-write flag silently widened the provider authority
available to the website agent during that session.

## Behavior

`smoke:google:stage1` now always supplies
`GOOGLE_ANALYTICS_WRITES_ENABLED=false`. GTM edit and publication capabilities remain
enabled only for `GTM-PCJ3Q5RK`; Analytics reads remain available. A separately
authorized GA4 write exercise must use its own explicit session and cannot leak into
this launcher through shell state.

## Regression coverage

`scripts/stage1-google-smoke.test.ts` first reproduced the inherited-authority gap and
now proves that `stage1SmokeEnvironment` overrides a parent
`GOOGLE_ANALYTICS_WRITES_ENABLED=true` value while retaining the exact GTM locks.

## Verification

`npm run verify` passed preflight and documentation checks, all workspace typechecks,
411 deterministic tests across 51 files, all builds, and 70 Chromium journeys.

## Exploratory review

Interactive review is not applicable because this is a process-environment authority
boundary with no product UI change. The focused regression inspects the exact child
environment without starting a credentialed API or contacting Google.

## Documentation

Updated the credentialed workflow issue, operator runbook, and current handoff
baseline.
