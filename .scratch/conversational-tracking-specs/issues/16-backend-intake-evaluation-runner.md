# Add the backend intake evaluation runner

Status: resolved

## Objective

Run two or three injected intake providers through the complete acceptance corpus on
the backend and atomically persist a privacy-safe comparison report without exposing a
frontend or network-triggered model route.

## Regression contract

Required test level:

- Deterministic backend runner and repository tests in
  `apps/api/src/intake-evaluations.test.ts` under `npm test`, consuming
  `tests/acceptance/intake-interpretation.json`.

Required fixtures and cases:

- Positive: two replaceable fixture providers run every corpus case through the shadow
  harness and weighted evaluator; one versioned report is saved and reopens unchanged.
- Degraded: provider rejection, exception, and timeout remain hard-failure or
  inconclusive case results while the complete comparison report is still saved.
- Invalid configuration: fewer than two, more than three, or duplicate provider IDs
  fail before any provider call or file write.
- Invalid persistence: malformed JSON, unsupported schemas, invalid summaries,
  duplicate report IDs, and duplicate creation fail closed.
- Privacy: the persisted report contains no corpus messages, candidate labels, private
  sentinels, deterministic interpretations, provider interpretations, raw responses,
  prompts, credentials, or exception text.

Required invariants:

- The runner accepts providers only through the SDK-neutral shadow-provider interface;
  no real SDK or credential is introduced in this slice.
- Every provider receives all corpus cases exactly once and every report contains two
  or three complete, runtime-validated provider evaluations over the same case IDs.
- Only evaluation outcomes, dimension scores, hard-failure codes, safe harness codes,
  timing, bounded usage totals, and opaque IDs are persisted.
- Reports are written atomically with owner-only `0600` mode and returned as clones.
- No server route, extension import, user-visible state, GTM mutation, or publication
  behavior is added.

## Work

- Define and runtime-validate the versioned comparison-report envelope.
- Implement the API-side runner with injected providers, clock, IDs, timeout, and
  report repository.
- Implement an atomic file repository with duplicate and corrupted-data protection.
- Document how a later credentialed command can call the runner without making model
  execution publicly triggerable.

## Done when

- Runner, degraded-provider, configuration, persistence, cloning, mode, and privacy
  tests pass in the ordinary deterministic harness.
- `npm run verify` and the exact-base change-documentation check pass.

## Comments

- 2026-08-23: Claimed after issue 15 established explicit semantic outcomes and
  provider summaries. This slice completes offline backend orchestration and durable
  reporting with fixtures only; real adapters, credentials, and paid calls remain
  separately authorized work.
- 2026-08-23: Added the two-or-three-provider backend runner, pre-call configuration
  checks, versioned report contract, atomic owner-only repository, degraded-provider
  continuation, clone isolation, and privacy-safe persistence. Focused backend coverage
  passed 4 tests and API strict TypeScript checking passed.
- 2026-08-23: `npm run verify` passed change-documentation and strict TypeScript
  checks, every workspace build, all 227 deterministic tests across 34 files, and all
  26 Chromium workflows. Interactive exploratory review is not applicable because the
  slice adds no real provider, HTTP route, or user-visible behavior.
