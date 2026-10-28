# Clear verification target controls review

Date: 2026-08-27

## Environment

- Built production extension in Chromium.
- Deterministic local API and lead-form fixture.
- Narrow 700-by-560 target viewport with a sticky 90-pixel page header.

## Scenarios

1. Started an exact draft run with the expanded agent overlapping a confirmed form.
2. Submitted a validation-error form from the ordinary already-installed check.
3. Repeated exact Preview on an attacker-labeled form target.

## Observations

- Starting verification centered the confirmed form and replaced the expanded agent
  with a visible `Verification active` dock.
- The dock settled at 166 by 50 pixels including its border and retained an accessible
  action for reopening the agent.
- The ordinary pointer hit the submit button rather than the extension host or sticky
  header. Exact evidence advanced to immutable version creation.
- Completed, failed, repair, publication, and live-verification results restored the
  full agent state.
- The private email sentinel and attacker-shaped label remained absent from durable
  evidence and executable markup.

## Findings

- No blocker, high-, medium-, or low-severity finding.

## Evidence

- Focused failing-first narrow-viewport journey.
- Complete form suite: 18 Chromium journeys passed.
- Active-state capture: test output `narrow-verification-active.png`.
- `npm run verify`: 421 deterministic tests and 74 Chromium journeys passed.
