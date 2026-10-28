# Multi-activity measurement-plan review

Date: 2026-08-27

## Environment

- Built production core, API, verification target, and Chromium extension.
- Deterministic local API and verification target with an intercepted, schema-valid
  multi-measurement interpretation; no external model, credential, or paid request.
- 1440-by-720 viewport with the compact website agent expanded over a page containing
  a form, file download, and phone link.

## Scenarios

1. Requested three activities, compared ready and already-covered items, and started
   the recommended form outcome.
2. Removed the grounded form after the plan appeared and then tried to start it.
3. Rendered a form label containing prompt-shaped HTML and policy-override language.
4. Requested the upper bound of twelve grounded phone outcomes and navigated to the
   final action.

## Observations

- The plan is visibly distinct from an Agent task. Each card exposes its outcome,
  interaction, page and success evidence, deterministic status, and item-specific
  start action. No setup approval appears before an item is selected.
- Exact GA4 automatic coverage marks the download as already covered while the form
  and phone outcomes remain independently startable. One item is recommended but is
  not selected automatically.
- Starting the form disables all plan actions and opens the existing single-outcome
  task. It does not perform setup, publication, or verification, and it causes no
  second interpretation request.
- Removing the form before selection fails closed without exposing setup review. The
  error explains that the activity could not be re-confirmed on the current page and
  asks the practitioner to restore the evidence before describing the task again.
- Prompt-shaped evidence remains inert text. The twelve-item plan stays within the
  compact surface, has no horizontal overflow, and keeps the final action reachable
  by vertical scrolling.

## Findings

- Low, resolved: the stale-evidence state originally described the selection only as
  unavailable. It now names the failed page re-confirmation and gives a clear recovery
  path.
- No unresolved blocker, high-, medium-, or low-severity finding within this slice.

## Evidence

- `packages/core/src/measurement-plan.test.ts`: 3 focused domain tests passed.
- `tests/e2e/measurement-plan.spec.ts`: 5 focused Chromium journeys passed.
- Full-resolution local captures: `measurement-plan-three-items.png`,
  `measurement-plan-selected-task.png`, `measurement-plan-stale-evidence.png`,
  `measurement-plan-adversarial.png`, and `measurement-plan-twelve-items.png`.
- Final complete repository verification: 482 deterministic tests and 95 Chromium
  journeys passed.
