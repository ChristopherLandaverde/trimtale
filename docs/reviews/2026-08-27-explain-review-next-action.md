# Form review next-action review

Date: 2026-08-27

## Environment

- Built production extension in Chromium.
- Deterministic two-form fixture at the compact 348-pixel website-agent width.
- Reviewed `guided-review-next-action-linux.png` at its original resolution.

## Scenarios

1. Selected Contact sales and inspected the complete read-only review decision before
   opening the setup.
2. Entered a short confirmation while two targets remained ambiguous, then typed a
   confirmation at the separate setup-approval boundary.
3. Rendered an attacker-shaped container name through the same guided journey and
   checked that it remained inert text.

## Observations

- The decision area names the exact review contents and states that nothing will be
  created yet.
- `Review what will be tracked` describes the next result without implying approval.
- The explanation and action remain below the six-stage rail and inside the message
  viewport. The composer is visible and receives the center-point hit target.
- Ambiguous target selection and setup approval remain behind explicit visible
  controls. Attacker-shaped connection text does not create markup or execute script.

## Findings

- High, resolved: the demo previously exposed only the generic `Review setup` action,
  leaving the review contents and safety boundary implicit.
- Medium, resolved: the first correction repeated an older assistant question above
  the new decision guidance. The redundant question was removed and the visual
  baseline was reviewed again.
- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- `tests/e2e/guided-task-journey.spec.ts` protects the positive, ambiguous, explicit-
  approval, layout, hit-target, and attacker-shaped states.
- `tests/e2e/guided-task-journey.spec.ts-snapshots/guided-review-next-action-linux.png`.
- Corrected focused Chromium journey: passed.
- Focused GA4 configuration journeys: two passed.
- `npm run verify`: 465 deterministic tests and 87 Chromium journeys passed.
