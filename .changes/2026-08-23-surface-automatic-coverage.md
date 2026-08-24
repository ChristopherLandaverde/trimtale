# Surface automatic coverage

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/33-surface-automatic-coverage.md`

## Summary

Moved the read-only automatic-coverage result into the main tracking task so the
practitioner sees the decision before custom setup.

## Why

The readiness audit is not useful if its result remains buried in a connection card.

## Behavior

- Navigation says `Partially covered` when GA4 automatic outbound clicks are active.
- Confirmed lead tracking says `Needs custom setup` because automatic form interactions
  do not prove a successful lead.
- A disabled master switch says `Needs setup`.
- Automatic outbound coverage removes `Track all` and opens an empty link selection.
- No audit preserves the existing task. Generation and Google authority are unchanged.

## Regression coverage

`packages/core/src/agent-turn.test.ts` covers partial navigation coverage, confirmed
lead boundaries, master-off behavior, and the existing unaudited path.
`tests/e2e/gtm-connection-context.spec.ts` proves the visible decisions and intentional
selection. `tests/e2e/connected-verification-evidence.spec.ts` protects the complete
confirmed-lead journey.

## Verification

- Focused core tests passed four cases.
- Focused connection and confirmed-lead suites passed 14 Chromium journeys.
- `npm run verify` passed 282 deterministic tests and 49 Chromium journeys.

## Exploratory review

[Automatic coverage task review](../docs/reviews/2026-08-23-surface-automatic-coverage.md)
covered partial navigation, confirmed leads, master-off, and malformed audit states.
One conflicting action was corrected; no finding remains.

## Documentation

The accepted specification, issue 33, and exploratory review record the visible
coverage decision and non-goals.
