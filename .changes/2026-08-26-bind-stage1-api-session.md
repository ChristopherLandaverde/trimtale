# Bind Stage 1 API readiness

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/11-credentialed-stage1-workflow.md`

## Summary

The credentialed launcher now accepts readiness only from the API process started for
the current session.

## Why

A stale service on the local API port could satisfy the generic health check before
the authority-locked backend finished starting.

## Behavior

Each launcher run assigns a fresh session identity to its backend and requires the
health response to echo that identity. The target URL, extension, container, GA4
destination, and mutation controls are unchanged.

## Regression coverage

`scripts/stage1-google-smoke.test.ts` proves matching readiness is accepted and stale
or absent session identities fail closed. It also proves an empty launcher identity
is rejected.

## Verification

- `npx vitest run scripts/stage1-google-smoke.test.ts`
- `npm run check`
- `npm run verify`

All pass.

## Exploratory review

Not applicable. This is an internal process-readiness boundary with no changed visual
surface; the credentialed real-Google lane remains separately gated.

## Documentation

Issue 11 records the session-bound readiness checkpoint.
