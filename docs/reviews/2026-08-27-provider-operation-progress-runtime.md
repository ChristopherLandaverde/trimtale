# Provider operation progress runtime review

Date: 2026-08-27

## Environment

- Built production core, API, fixture site, verification target, and extension.
- Chromium with a deliberately delayed validation response and read-only progress
  response.
- Deterministic runner tests with a deferred provider request, reopened operation
  repository, and secret-bearing provider exception.

## Scenarios

1. Left validation active beyond the website agent's display wait.
2. Read progress while the original mutation remained in flight.
3. Repeated the same application action during its live provider attempt.
4. Reopened the durable store from a new runner while the attempt remained started.
5. Failed an application with a provider exception containing a private sentinel.
6. Completed the delayed workflow and reached the exact Preview handoff.

## Observations

- The website agent displayed `Validation · in flight`, the longer-than-expected
  wording, exact elapsed seconds, and an explicit statement that time does not decide
  success or failure.
- The progress read issued no provider call and exposed no retry action.
- The duplicate application returned current progress and kept the provider call count
  at one.
- The reopened runner returned `reconciling` and made zero provider calls.
- Durable failure data contained only `provider_forbidden`; the private exception text
  was absent from the operation and progress projection.
- The original request completed normally and advanced to the exact Preview checkpoint.

## Findings

- No blocker, high-, medium-, or low-severity finding.

## Evidence

- Focused core and runner tests: 44 passed.
- Focused Chromium provider-progress journey: 1 passed.
- Full verification: 442 deterministic tests and 76 Chromium journeys passed.
