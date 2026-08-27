# Contextual confirmation replies review

Date: 2026-08-27

## Environment

- Built production extension in Chromium.
- Safe Stage 1 interactive demo and deterministic two-form fixture.
- Compact 348-pixel website-agent surface.

## Scenarios

1. Typed `confirm` while two form targets were visible at Confirm measurement scope.
2. Selected one target, then typed `continue` while the single read-only Review setup
   action was visible.
3. Typed `yes` while Approve setup was visible.

## Observations

- The ambiguous confirmation remains in the existing task and names both visible form
  choices without selecting either one.
- The single read-only review advances to the exact reviewable specification.
- The approval confirmation remains inert and directs the practitioner to the visible
  Approve setup button.
- The six-stage rail, target highlight, action receipts, composer, and primary controls
  remain visible and readable.
- No short reply activates application, publication, rollback, or another provider
  mutation.

## Findings

- High, resolved: a bare confirmation previously became a new unknown intake and
  appeared to stall the demo at Confirm measurement scope.
- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- `tests/e2e/guided-task-journey.spec.ts` covers ambiguous choice preservation,
  read-only continuation, and explicit approval retention.
- `tests/e2e/guided-task-journey.spec.ts-snapshots/guided-contextual-confirmation-linux.png`.
- Focused contextual-confirmation journey: passed.
- Complete guided journey file: five Chromium journeys passed before the visual
  baseline was added.
- Complete GTM-context file: 14 Chromium journeys passed.
- `npm run verify`: 463 deterministic tests and 87 Chromium journeys passed.
