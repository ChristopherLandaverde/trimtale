# Add a provider-neutral intake shadow harness

Status: resolved

## Objective

Run the versioned intake acceptance corpus through replaceable provider adapters while
keeping every provider result non-authoritative and invisible to the practitioner
workflow.

## Regression contract

Required test level:

- Deterministic harness tests in `packages/core/src/intake-shadow.test.ts` under
  `npm test`, consuming `tests/acceptance/intake-interpretation.json`.

Required fixtures and cases:

- Positive: a replaceable fixture provider returns every corpus interpretation; each
  shadow record pairs the validated provider interpretation with the validated
  deterministic baseline.
- Negative: invalid input or baseline fails before the provider is called, and invalid
  provider output is discarded rather than recorded.
- Inconclusive: provider errors and bounded timeouts produce safe, non-authoritative
  records without raw provider output or exception text.
- Privacy: shadow records contain no messages, candidate labels, raw provider response,
  private sentinel, prompt, credential, or provider exception detail.

Required invariants:

- The harness validates input and deterministic baseline before provider execution and
  validates the provider envelope and interpretation afterward.
- Providers are injected behind one SDK-neutral interface and receive a cloned,
  allowlisted intake input plus an abort signal.
- Every record retains only opaque run, input, and provider IDs; coarse counts; timing;
  optional bounded usage metrics; the deterministic baseline; and a validated provider
  interpretation or safe failure code.
- Interpretation authority remains false for specification confirmation, GTM writes,
  evidence verdicts, and platform-receipt claims.
- The harness has no import from a provider SDK and no extension or API route consumes
  its result in this slice.

## Work

- Define and runtime-validate the versioned shadow record and provider envelope.
- Implement one-run and corpus-run helpers with injected clock, ID source, and timeout.
- Consume the existing intake acceptance corpus in permanent tests.
- Document the provider boundary, retained record shape, and deliberate non-UI scope.

## Done when

- Positive, invalid, provider-error, timeout, privacy, and non-mutation tests pass in
  the ordinary deterministic harness.
- `npm run verify` and the base-aware change-documentation check pass.

## Comments

- 2026-08-23: Claimed after issue 13 established the versioned intake interpretation
  and acceptance-corpus contract. This slice adds offline shadow execution only; model
  comparison, real credentials, persistence, routing, and visible suggestions remain
  follow-up work.
- 2026-08-23: Added the provider-neutral one-run and corpus-run harness, versioned
  privacy-safe records, strict provider-envelope validation, bounded usage metrics,
  safe error and timeout codes, and abort signaling. Focused harness coverage passed 6
  tests and core strict TypeScript checking passed.
- 2026-08-23: `npm run verify` passed change-documentation and strict TypeScript
  checks, every workspace build, all 217 deterministic tests across 32 files, and all
  26 Chromium workflows. Interactive exploratory review is not applicable because the
  slice adds no real provider execution, API endpoint, or user-visible behavior.
