# Lock the Stage 1 URL fragment

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/11-credentialed-stage1-workflow.md`

## Summary

The credentialed launcher now requires the website URL fragment to match its declared
Stage 1 target.

## Why

Client-side applications can change page behavior from a fragment even when origin,
path, and query are unchanged.

## Behavior

The exact-target gate now rejects unexpected URL fragments before the launcher
announces readiness. Existing origin, path, query, container, and GA4 checks are
unchanged.

## Regression coverage

`scripts/stage1-google-smoke.test.ts` proves an attacker-shaped fragment fails the
exact website target check.

## Verification

- `npx vitest run scripts/stage1-google-smoke.test.ts`
- `npm run verify`

All pass.

## Exploratory review

Not applicable. This internal launcher guard has no changed visual surface.

## Documentation

Issue 11 records the complete exact-URL checkpoint.
