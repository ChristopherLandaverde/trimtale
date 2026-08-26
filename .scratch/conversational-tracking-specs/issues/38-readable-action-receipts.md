# Keep compact action receipts readable

Delivery mode: implementation
Status: resolved

## Production outcome

Action receipts reserve readable space for their label and wrap longer evidence detail
within the remaining width of the compact overlay.

## Non-goals

- Changing receipt values, privacy filtering, evidence meaning, or task semantics.
- Expanding the overlay, adding disclosure controls, or redesigning other evidence
  cards.

## Authorization

The user explicitly approved fixing the readable-receipt and long-review UX gaps on
2026-08-25 after reviewing their proposed behavior and non-goals.

## Regression contract

- `tests/e2e/known-link-interactions.spec.ts` proves the `Page inspected` label remains
  wide enough to read when its detail contains multiple interaction counts.
- The same browser contract proves the detail remains bounded by the receipt row and
  the compact task has no horizontal overflow.

## Evidence

The visible target-certainty review submitted four known-link requests in one compact
workbench. The long `Page inspected` detail consumed the receipt grid's available
width and squeezed the label into one character per line. The values remained correct,
but the receipt was not readable at a glance.

## Dependencies

- Issue 37 visible target certainty supplied the multi-interaction discovery case.

## Comments

- 2026-08-25: Reserved a bounded label column and a wrapping detail column for every
  action receipt. The regression first measured the long `Page inspected` label at
  zero pixels, then passed with at least 72 pixels and no row or task overflow. Visual
  review found no unresolved blocker or high-severity issue. `npm run verify` passed
  404 deterministic tests and 61 Chromium journeys; all builds, typechecks, preflight
  checks, and 70 change records passed.
