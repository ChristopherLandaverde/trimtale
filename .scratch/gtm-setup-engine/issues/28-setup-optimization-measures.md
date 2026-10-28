# Establish setup optimization measures

Delivery mode: discovery
Status: resolved

## Discovery result

Use eight measure families. Every sample is labeled `local_deterministic` or
`credentialed_google`; the two strata are never pooled:

1. `time_to_verified_setup`: milliseconds from tracking-intent submission to the first
   passing browser check for the generated setup.
2. `first_pass_verification_rate`: passing first browser checks divided by workflows
   expected to pass.
3. `false_positive_rate`: defect-exposing or non-conversion scenarios incorrectly
   reported as passing divided by all such scenarios.
4. `false_negative_rate`: known-correct scenarios incorrectly reported as non-passing
   divided by all known-correct scenarios.
5. `provider_activity_counts`: separate read-call, mutation-call, and failed-call
   counts per operation and provider stage.
6. `restart_recovery_rate`: interrupted operations that recover the expected durable
   checkpoint with zero duplicate mutations divided by interrupted samples.
7. `clarification_count`: specification-changing questions answered between intent
   submission and confirmed tracking specification.
8. `required_human_action_count`: required practitioner control activations after
   intent submission through the terminal browser verdict, including approval
   checkpoints, supported provider handoffs, and the guided site interaction.

Counts exclude test harness setup, fixture routing, waits, screenshots, and automated
progress reads. Time distributions report sample count, minimum, p50, p90, and maximum;
rates always report numerator and denominator. No single best-case value is a baseline.

## Privacy boundary

Optimization samples may retain measure ID, sample stratum, setup type, timestamps,
durations, verdict category, provider stage, and aggregate counts. They exclude intent
text, page labels, URLs and query strings, selectors, form values, request payloads,
cookies, credentials, account identity, and raw provider errors.

## Initial local baseline

On 2026-08-27, four existing Chromium journeys ran five times each; all 20 passed.
Playwright test-body duration is an upper-bound workflow proxy because the current
harness does not timestamp intent submission and first passing browser evidence
separately:

| Journey | Runs | Min | p50 | p90/max |
| --- | ---: | ---: | ---: | ---: |
| Static exact form through immutable version | 5 | 3.173s | 3.194s | 3.213s |
| Phone-click exact workflow | 5 | 3.308s | 3.346s | 3.413s |
| Validated-operation restart recovery | 5 | 1.162s | 1.193s | 1.519s |
| Exact-Preview target-drift rejection | 5 | 1.327s | 1.349s | 1.400s |

- First-pass verification: 10/10 expected-passing exact form and phone samples.
- Restart recovery: 5/5 restored the exact Preview binding with one resume request and
  no repeated application.
- Verdict corpus: 0/10 non-passing scenarios falsely passed and 0/6 known-correct
  scenarios failed across the 16 deterministic form fixtures.
- Current static exact-form workflow: one specification-changing target choice and
  nine required post-intent practitioner actions.
- Provider read/write counts: not observable in mocked local browser routes and
  therefore not reported as zero.
- Credentialed Google baseline: not computed retrospectively because existing review
  timestamps do not share the new start and terminal definitions.

These values establish measurement feasibility, not performance targets. True product
time and provider-activity baselines require separately authorized instrumentation and
new representative credentialed runs.

## Non-goals

- Collecting private page or form data.
- Optimizing only one disposable fixture.
- Setting latency targets before representative measurements exist.
- Trading approval, exact binding, or negative evidence for speed.
- Pooling local deterministic durations with real Google latency.
- Reporting unavailable provider activity as zero.

## Regression contract

- `tests/acceptance/setup-optimization-measures.json` records every measure's start,
  terminal condition, unit, aggregation, stratum, and privacy exclusions.
- `packages/core/src/setup-measures-acceptance.test.ts` validates the measurement rules
  and initial local baseline. It is not production telemetry or a performance gate.
- The raw temporary Playwright JSON is not committed; the review record contains only
  aggregate durations and outcome counts.

## Authorization

The user authorized completing the remaining automatable product slices on 2026-08-27.
This discovery does not authorize production instrumentation, latency budgets, or a
credentialed Google mutation run.

## Comments

- 2026-08-26: The existing primary measure remains time to verified setup. This issue
  makes the supporting reliability and authority costs comparable before optimization.
- 2026-08-27: Defined the eight measure families and privacy boundary. Recorded five
  local repetitions for four representative workflows, explicitly separating proxy
  duration from true time to verified setup and unavailable provider-call counts from
  observed zeros.
