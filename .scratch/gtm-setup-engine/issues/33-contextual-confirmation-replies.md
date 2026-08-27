# Preserve context for short confirmation replies

Delivery mode: implementation
Status: resolved

## Production outcome

When a practitioner types `confirm`, `yes`, `continue`, `ok`, or `okay` while one
read-only setup-review action is visible, the website agent advances that review in
the current task instead of starting a new stateless intake request.

When the current task requires a choice or an approval, the same short reply preserves
the task and directs the practitioner to the visible controls. It never chooses scope,
target, evidence, application, publication, rollback, or another authority-granting
action on the practitioner's behalf.

## Non-goals

- Natural-language stateful conversation beyond the five exact acknowledgements.
- Treating typed text as provider-mutation or approval authority.
- Removing visible controls or changing provider APIs.

## Authorization

The practitioner reported the broken contextual confirmation while exercising the
authorized full UX slice on 2026-08-27. Restoring that demo journey without widening
approval behavior is remediation within the authorized slice.

## Regression contract

- `tests/e2e/guided-task-journey.spec.ts` proves a short confirmation does not discard
  a multi-target task, advances the one visible read-only Review setup action, and
  cannot activate the subsequent Approve setup action.
- Existing application, publication, and rollback journeys continue to require their
  exact visible controls.

## Comments

- 2026-08-27: Claimed after reproducing the demo report. The existing composer treated
  `confirm` as a new unknown intake rather than a reply to the visible task.
- 2026-08-27: Implemented bounded contextual acknowledgements. The focused regression,
  five guided journeys, 14 GTM-context journeys, and `npm run verify` passed; the full
  gate covered 463 deterministic tests and 87 Chromium journeys.
