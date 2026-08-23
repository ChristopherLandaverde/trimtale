# Add the backend intake evaluation runner

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/16-backend-intake-evaluation-runner.md`

## Summary

The API package can now run two or three injected intake providers through the complete
acceptance corpus and atomically persist a privacy-safe, versioned comparison report.

## Why

The weighted evaluator needs backend orchestration and durable evidence before real
credentials or paid provider calls can be introduced, while model execution must stay
off the public API surface.

## Behavior

The runner preflights provider count, IDs, uniqueness, timeout, report ID, duplicate
identity, clock, and corpus before execution. It runs every provider across every case,
keeps rejected, failed, and timed-out calls as comparison evidence, evaluates all
records, and persists only compact semantic outcomes and aggregate metrics.

The atomic file repository writes with `0600` mode, returns clones, and rejects corrupt,
unsupported, invalid, or duplicate data. Reports exclude messages, labels, expected and
provider interpretations, raw responses, prompts, credentials, and exception text.

This slice adds no real provider, SDK, credential, command, HTTP route, extension
consumer, visible behavior, GTM mutation, or publication behavior.

## Regression coverage

`apps/api/src/intake-evaluations.test.ts` protects complete two-provider execution,
degraded provider continuation, outcome counts, atomic owner-only persistence, reopening,
cloning, private-data exclusion, provider preflight, duplicate prevention, corrupted and
unsupported collection rejection, invalid report rejection, and cross-provider case
coverage consistency.

## Verification

Focused backend evaluation coverage passed 4 tests, and API strict TypeScript checking
passed. `npm run verify` passed change-documentation and strict TypeScript checks,
every workspace build, all 227 deterministic tests across 34 files, and all 26
Chromium workflows.

## Exploratory review

Not applicable. This is an offline backend runner and file repository with no HTTP
route, real provider, or user-visible browser behavior.

## Documentation

The conversational tracking specification and intake interpretation engineering guide
document backend orchestration, persistence, privacy, and public-route boundaries.
Current capabilities and the roadmap identify authorized real adapters and an
owner-operated comparison command as the next backend boundary.
