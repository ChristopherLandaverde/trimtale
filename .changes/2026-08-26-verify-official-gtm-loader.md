# Verify the official GTM loader

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/11-credentialed-stage1-workflow.md`

## Summary

The credentialed launcher now recognizes a page container only from the official
HTTPS Google Tag Manager loader URL.

## Why

The prior substring selector could treat an attacker-owned script URL containing GTM
text as evidence that the declared container was installed.

## Behavior

Container discovery requires `https://www.googletagmanager.com/gtm.js` before reading
its public ID. Wrong origins, insecure URLs, and alternate paths are ignored. The
declared container and provider-recognition gates remain unchanged.

## Regression coverage

`scripts/stage1-google-smoke.test.ts` proves the official loader is accepted and
attacker-owned, insecure, and alternate-path scripts are rejected.

## Verification

- `npx vitest run scripts/stage1-google-smoke.test.ts`
- `npm run check`
- `npm run verify`

All pass.

## Exploratory review

Not applicable. This internal launcher guard has no changed visual surface.

## Documentation

Issue 11 records the official-loader checkpoint.
