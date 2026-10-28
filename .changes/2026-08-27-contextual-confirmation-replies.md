# Preserve contextual confirmations

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/33-contextual-confirmation-replies.md`

## Summary

Short confirmation replies now remain bound to the visible task, advance one safe
read-only review, and preserve explicit choices and approvals.

## Why

The safe interactive demo appeared to stall when a practitioner typed `confirm` at
Confirm measurement scope because the reply started an unrelated unknown intake.

## Behavior

The exact acknowledgements `confirm`, `yes`, `continue`, `ok`, and `okay` inspect the
current task's visible actions. One read-only setup-review action may advance. Multiple
choices remain visible and are named in guidance; a single choice or approval remains
behind its button. All other text continues through ordinary intake.

Provider APIs, supported intents, scope selection, setup approval, application,
publication, rollback, and authority boundaries are unchanged. Typed text cannot
grant mutation authority.

## Regression coverage

`tests/e2e/guided-task-journey.spec.ts` reproduces the two-target confirmation report,
proves the task is preserved, advances one visible Review setup action, and proves a
subsequent typed `yes` does not activate Approve setup. The contextual guidance has an
intentional reviewed Chromium baseline.

The existing GTM-context screenshot helper now keeps expanded cards within a stable
parent width and normalizes the sticky journey outside task-only captures. The
automatic-coverage task baseline was intentionally replaced after visual review; its
product appearance is unchanged.

## Verification

- Failing-first contextual confirmation journey: reproduced.
- Corrected contextual confirmation journey: passed.
- Complete guided journey file: five Chromium journeys passed before adding the
  reviewed baseline.
- Complete GTM-context file: 14 Chromium journeys passed.
- Final `npm run verify`: 463 deterministic tests and 87 Chromium journeys passed.

## Exploratory review

See `docs/reviews/2026-08-27-contextual-confirmation-replies.md`. The reported demo
failure, read-only continuation, and explicit approval boundary were reviewed. One
high finding was resolved; no unresolved finding remains.

## Documentation

Updated the setup-engine specification, current capabilities, Issue 33, and the
contextual confirmation review.
