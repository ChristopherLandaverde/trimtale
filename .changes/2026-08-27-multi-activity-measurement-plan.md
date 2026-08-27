# Present a multi-activity measurement plan

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/41-multi-activity-measurement-plan.md`

## Summary

Added a runtime-validated measurement plan for two to twelve grounded activities and a
one-time selection path into the existing single-outcome agent task.

## Why

A practitioner should be able to describe several measurement outcomes once, review
how each is grounded, and deliberately start one existing safe workflow.

## Behavior

One valid multi-measurement interpretation now produces a dedicated plan showing each
conversion outcome, observed interaction, privacy-filtered page evidence, deterministic
readiness or exact automatic-coverage status, and one recommended start. The plan has
no setup approval or mutation action.

Selecting a startable item disables every plan action, performs a fresh page scan, and
consumes the service worker's bounded in-memory selection. Exact form and success
evidence or known-interaction evidence must still exist. The selected item enters the
existing agent task without another model request. Invalid grounding, stale evidence,
ambiguous items, unsupported items, and expired plans fail closed.

Batch setup, combined approval, persistence, reload recovery, automatic continuation,
publication, verification, model activation, and new tracking capabilities remain out
of scope.

## Regression coverage

- `packages/core/src/measurement-plan.test.ts` protects the bounded contract,
  deterministic status classification, a required startable recommendation, exact
  one-item selection, stale-evidence rejection, and invalid-plan rejection.
- `tests/e2e/measurement-plan.spec.ts` protects the three-activity plan, exact download
  coverage, one-request form selection, invented grounding, page drift, inert prompt-
  shaped evidence, and reachable 12-item upper bound without horizontal overflow.
- The existing multi-measurement goal-intake regression now requires a plan instead of
  the deliberately replaced generic focus fallback while retaining its no-review and
  no-approval assertions. Other intake and agent-turn regressions protect the single-
  measurement fallback and selected task contract.

## Verification

- Focused measurement-plan domain tests: 3 passed.
- Focused measurement-plan Chromium journeys: 5 passed.
- Final `npm run verify`: 482 deterministic tests and 95 Chromium journeys passed.

## Exploratory review

Reviewed the happy, stale-evidence, prompt-shaped-evidence, and 12-item journeys in
production Chromium. The stale-evidence recovery copy was improved during review; no
unresolved finding remains. See
`docs/reviews/2026-08-27-multi-activity-measurement-plan.md`.

## Documentation

Added the measurement-plan glossary boundary, specification, implementation issue,
intake contract, current-capability note, and exploratory review.
