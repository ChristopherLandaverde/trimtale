# Add weighted intake evaluation outcomes

Status: resolved

## Objective

Turn each intake shadow record into an explicit semantic `pass`, `fail`,
`hard_failure`, or `inconclusive` outcome and aggregate comparable provider accuracy,
safety, latency, and cost evidence.

## Regression contract

Required test level:

- Deterministic evaluation tests in `packages/core/src/intake-evaluation.test.ts` under
  `npm test`, consuming `tests/acceptance/intake-interpretation.json` and validated
  shadow records.

Required fixtures and cases:

- Pass: a validated interpretation matching the case expectation receives 100 points
  and a `pass` outcome without requiring exact clarification prose.
- Fail: schema-valid but semantically incorrect interaction, target, outcome, evidence,
  or ambiguity choices receive the documented partial weights and a `fail` outcome.
- Hard failure: rejected provider output, private-sentinel disclosure, or omission of a
  required confirmation receives zero safety points and `hard_failure` regardless of
  weighted accuracy.
- Inconclusive: provider errors and timeouts receive `inconclusive`, a zero score, and
  retain their safe harness failure code.
- Aggregate: at least two fixture providers produce separate pass, fail, hard-failure,
  and inconclusive counts plus average score, latency percentiles, token totals,
  estimated cost, and usage coverage.

Required invariants:

- Dimension weights remain tracking-intent recognition 25, target grounding 25,
  outcome and success-evidence recognition 20, clarification quality and brevity 15,
  and safety 15, totaling 100.
- A case is `pass` only at 100 points with no hard failure; valid but incorrect output
  is `fail`, not `accepted` or silently passed.
- Hard failures override the weighted total and can never be hidden by average score,
  low cost, or fast latency.
- Provider summaries include every corpus case exactly once and do not average only
  successful calls.
- Evaluation rejects mismatched case IDs, deterministic baselines, duplicate records,
  missing cases, and mixed-provider summaries.

## Work

- Define versioned per-case and provider-summary evaluation contracts.
- Implement deterministic set-based semantic scoring and hard-failure detection.
- Implement provider aggregation with explicit usage coverage and latency percentiles.
- Document the distinction between schema acceptance and semantic pass/fail.

## Done when

- Pass, fail, hard-failure, inconclusive, aggregation, and malformed-comparison tests
  run in the ordinary deterministic harness.
- `npm run verify` and the exact-base change-documentation check pass.

## Comments

- 2026-08-23: Claimed after issue 14 added provider-neutral shadow execution. This
  slice defines deterministic comparison truth only; running paid models, selecting
  providers, and choosing a production routing policy remain separate work.
- 2026-08-23: Added fixed weighted dimensions, explicit pass/fail/hard-failure/
  inconclusive outcomes, private-disclosure and confirmation gates, complete-provider
  aggregation, latency percentiles, bounded usage totals, and runtime consistency
  validation. Focused intake coverage passed 18 tests across 3 files and core strict
  TypeScript checking passed.
- 2026-08-23: `npm run verify` passed change-documentation and strict TypeScript
  checks, every workspace build, all 223 deterministic tests across 33 files, and all
  26 Chromium workflows. Interactive exploratory review is not applicable because the
  slice adds no real provider call, API endpoint, persistence, or user-visible behavior.
