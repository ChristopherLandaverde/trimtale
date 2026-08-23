# Keep npm preflight reliable in managed sandboxes

Change record version: 2

Issue: `.scratch/workflow-automation/issues/09-managed-sandbox-npm-preflight.md`

## Summary

The local readiness preflight now falls back to npm's standard lifecycle metadata
when a managed sandbox suppresses npm version subprocess output.

## Why

The installed npm 10 runtime was incorrectly reported as unsupported, which stopped
the required local verification gate before any product checks could run.

## Behavior

Valid non-empty `npm --version` subprocess output remains authoritative. When that
output is unavailable, preflight accepts a valid version from
`npm_config_user_agent`; absent or malformed evidence still fails closed as version
`0`. No Google credentials, product behavior, publication boundary, or browser
workflow changed.

## Regression coverage

`scripts/workflow-preflight.test.ts` protects subprocess precedence, managed-sandbox
lifecycle fallback, and malformed or missing evidence. The real agent preflight is
also exercised in the local verification evidence.

## Verification

Focused preflight coverage passed 10 tests, and `npm run agent -- preflight` reported
all six local readiness checks passing. `npm run verify` passed change-documentation
and strict TypeScript checks, all 202 deterministic tests across 29 files, every
workspace build, and all 25 Chromium workflows.

## Exploratory review

Not applicable. This is an internal command-line readiness check with no user-visible
product or browser workflow change.

## Documentation

The accepted workflow-automation specification records the managed-sandbox runtime
detection invariant, and issue 09 records the regression contract and evidence.
