# Explain the review next action

Delivery mode: implementation
Status: resolved

## Production outcome

When a form setup is ready for review, the visible next-action area states what the
review contains—form, success signal, event name, and privacy boundary—and that nothing
will be created yet. The action reads `Review what will be tracked` instead of the
generic `Review setup`.

The guidance and action remain visible together below the sticky journey rail in the
compact website-agent viewport.

## Non-goals

- Removing the separate Approve setup decision.
- Changing setup contents, provider authority, or evidence rules.
- Generalizing explanatory copy for every action in this slice.

## Authorization

The practitioner explicitly requested a better UX test after the fresh demo exposed
that the Review stage effectively showed only `Review setup` on 2026-08-27.

## Regression contract

- `tests/e2e/guided-task-journey.spec.ts` requires the explanation and descriptive
  action to be simultaneously visible inside the compact message viewport and records
  their reviewed Chromium baseline.
- Existing form journeys continue through the renamed read-only review action and the
  separate Approve setup action.

## Comments

- 2026-08-27: Claimed from direct demo feedback. Existing tests asserted action
  existence but did not test whether the decision context was visible with it.
- 2026-08-27: Failing-first Chromium coverage reproduced the generic action. The
  corrected compact baseline keeps the rationale, no-creation boundary, descriptive
  action, and unobstructed composer visible together.
- 2026-08-27: Resolved after the focused decision-state and GA4 journeys passed,
  visual review found no unresolved finding, and `npm run verify` passed 465
  deterministic tests and 87 Chromium journeys.
