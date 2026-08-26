# Visible model-authored setup review

Date: 2026-08-26

## Environment

- Built production extension in headed managed Chromium.
- Local deterministic API and verification target.
- Controlled configured-model response and managed-workspace plan.
- No real model charge or Google workspace mutation.

## Scenarios

1. Confirmed one page-scoped phone-link interaction, explicitly requested a model
   alternative, reviewed `contact_intent` and its parameter classifications, approved
   it, and sent it to durable planning.
2. Exercised the existing unavailable-provider path, which retained the deterministic
   setup and offered a return action.
3. Used a private `tel:` value and attacker-shaped link label on the page.

## Observations

- The model call occurs only after **Ask model for alternative**.
- Event, configured author, rationale, and prohibited `phone_number` classification
  appear in a scrollable review receipt before approval.
- Approval remains separate from the model result and from the later plan/apply
  authority checkpoint.
- The durable planning body contains the confirmed authored setup and deterministic
  selector grounding, but not the private phone value or attacker-shaped label.
- The task and affected phone link remain usable at the tested overlay size.

## Findings

- Fixed during review: the receipt was originally appended after the action buttons
  and fell below the composer at the tested overlay size. It now precedes approval,
  and the journey asserts that the receipt can be scrolled into the viewport.
- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- `npm run verify`: 411 deterministic tests and 64 Chromium journeys passed.
- Headed focused review: the model-authored journey passed.
- Capture: `model-authored-setup-review.png` under the focused Playwright result
  directory.
