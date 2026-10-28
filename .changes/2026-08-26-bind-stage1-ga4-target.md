# Bind the Stage 1 GA4 target

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/11-credentialed-stage1-workflow.md`

## Summary

Add a fresh read-only provider-recognition gate that binds the credentialed Stage 1
launcher to its declared GTM container and GA4 destination before readiness.

## Why

The launcher declared `G-YV879ECLRV` but only inspected the page's GTM script before
announcing that its write-enabled session was ready. Live-container destination drift
could therefore remain undiscovered until the practitioner entered the workflow.

## Behavior

After verifying the extension, page URL, and observed GTM script, the launcher now
calls the existing read-only container-inspection route. Readiness requires enabled
container-write capability, recognized `GTM-PCJ3Q5RK` provider state, and exactly one
GA4 destination equal to `G-YV879ECLRV`. Provider failure, malformed data,
inaccessibility, ambiguity, target drift, or destination drift stops the launcher.
No workspace, version, publication, rollback, or Analytics mutation occurs in this
gate.

## Regression coverage

`scripts/stage1-google-smoke.test.ts` first failed because no recognition gate existed,
then proved the exact recognized target and GA4 destination pass while a wrong
destination and ambiguous container fail.

## Verification

`npm run verify` passed preflight and documentation checks, all workspace typechecks,
412 deterministic tests across 51 files, all builds, and 70 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-stage1-recognition-gate.md`. This pre-ready provider
assertion has no product UI change. Controlled responses cover fail-closed branches,
and the saved session passed the GET-only gate against current Google state without a
mutation.

## Documentation

Updated the credentialed workflow issue, operator runbook, current recognition review,
and handoff baseline.
