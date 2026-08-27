# Setup optimization baseline

Date: 2026-08-27

## Boundary

This discovery defines measurement rules and records aggregate local evidence. It does
not add production telemetry, performance targets, provider instrumentation, or a
credentialed Google mutation run.

## Samples

Four existing Chromium journeys ran five times each against deterministic local
services and mocked provider routes:

| Journey | Runs | Min | p50 | p90/max |
| --- | ---: | ---: | ---: | ---: |
| Static exact form through immutable version | 5 | 3.173s | 3.194s | 3.213s |
| Phone-click exact workflow | 5 | 3.308s | 3.346s | 3.413s |
| Validated-operation restart recovery | 5 | 1.162s | 1.193s | 1.519s |
| Exact-Preview target-drift rejection | 5 | 1.327s | 1.349s | 1.400s |

All 20 runs passed. Durations are Playwright test-body wall time and therefore only an
upper-bound workflow proxy. The product does not yet emit the exact intent-submission
and first-browser-pass timestamps required for true time to verified setup.

## Reliability counts

- First-pass expected-success samples: 10/10.
- Restart recovery without repeated application: 5/5.
- Deterministic fixture verdicts: 0 false passes among 10 non-passing scenarios and 0
  false failures among 6 known-correct scenarios.
- Static exact form: one specification-changing target choice and nine required
  practitioner actions after intent submission.

## Unavailable measures

Local browser routes mock the backend boundary, so real Google reads and mutations are
not observable and are not reported as zero. Existing credentialed review timestamps
do not share the newly defined start and terminal conditions, so they are not combined
with this baseline or reconstructed retrospectively.

## Privacy review

The committed baseline contains only sample identifiers, strata, aggregate durations,
verdict categories, and counts. The temporary Playwright JSON was not committed. No
intent text, labels, URLs, selectors, form values, request payloads, cookies,
credentials, account identity, or raw provider errors were retained.

## Findings

- No blocker or high-severity finding.
- Measurement gap: true time to verified setup and provider activity need separately
  authorized instrumentation before optimization targets can be proposed.
