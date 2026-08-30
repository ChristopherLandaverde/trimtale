# Add a provider-neutral intake shadow harness

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/14-intake-shadow-harness.md`

## Summary

The shared domain package can now run the intake acceptance corpus through replaceable
provider adapters and return privacy-safe shadow records beside the deterministic
baseline.

## Why

Provider behavior must be evaluated behind the versioned intake contract before a real
model, SDK, credential, or visible suggestion is connected to conversation intake.

## Behavior

The harness validates input and deterministic baseline before calling a provider,
passes only a cloned allowlisted input plus an abort signal, bounds execution, and
validates the provider envelope and interpretation afterward. Accepted records retain
the validated interpretation and optional bounded usage metrics. Invalid output,
provider failures, and timeouts retain only safe status and failure codes.

Records omit messages, candidate labels, raw provider output, prompts, credentials, and
exception text. This slice adds no real provider, persistence, backend route, extension
consumer, visible behavior, GTM mutation, or publication behavior.

## Regression coverage

`packages/core/src/intake-shadow.test.ts` consumes all 14 intake acceptance cases and
protects accepted baseline pairing, pre-call input and baseline rejection, invalid
output disposal, exception privacy, timeout abortion, input mutation isolation, and
private-sentinel exclusion.

## Verification

Focused shadow-harness coverage passed 6 tests, and core strict TypeScript checking
passed. `npm run verify` passed change-documentation and strict TypeScript checks,
every workspace build, all 217 deterministic tests across 32 files, and all 26
Chromium workflows.

## Exploratory review

Not applicable. This is an offline provider interface and domain record with no real
provider execution, API endpoint, or user-visible browser behavior.

## Documentation

The conversational tracking specification and intake interpretation engineering guide
document the shadow boundary and retained record shape. Current capabilities now name
the offline weighted comparison as the next implementation boundary.
