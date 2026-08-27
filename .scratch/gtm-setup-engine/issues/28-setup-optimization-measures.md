# Establish setup optimization measures

Delivery mode: discovery
Status: open

## Question

Which measurements show that setup is becoming faster and more reliable without
hiding false verdicts or increasing provider authority?

## Discovery boundary

Define representative workflow samples and measurement rules for time to verified
setup, first-pass verification, false-positive and false-negative verdicts, provider
calls and writes, restart recovery, clarification count, and required human actions.
Do not add production telemetry or performance gates in this issue.

## Non-goals

- Collecting private page or form data.
- Optimizing only one disposable fixture.
- Setting latency targets before representative measurements exist.
- Trading approval, exact binding, or negative evidence for speed.

## Evidence outline

- Every measure has a start, terminal condition, unit, and privacy boundary.
- Samples distinguish local fixtures from credentialed Google runs.
- Baselines report distributions and failure categories rather than one best-case time.

## Comments

- 2026-08-26: The existing primary measure remains time to verified setup. This issue
  makes the supporting reliability and authority costs comparable before optimization.
