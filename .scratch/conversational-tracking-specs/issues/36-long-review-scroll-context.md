# Preserve long review context in the compact overlay

Delivery mode: implementation
Status: resolved

## Production outcome

When an in-place task becomes taller than the message viewport, the compact website
agent positions the task at its beginning so its status, goal, and review context are
visible. The practitioner can scroll within the overlay to the unchanged actions.

## Non-goals

- Making actions sticky, expanding ordinary short tasks, or resizing the overlay.
- Changing setup semantics, approval authority, interaction recipes, or review copy.
- Changing ordinary user and assistant message autoscroll.

## Authorization

The user explicitly approved fixing the readable-receipt and long-review UX gaps on
2026-08-25 after reviewing their proposed behavior and non-goals.

## Regression contract

- `tests/e2e/email-link-interactions.spec.ts` proves a long setup review opens with
  its task heading inside the visible message viewport.
- The same browser journey proves the existing approval action remains reachable by
  scrolling within the overlay.

## Evidence

Exploratory review of automatic-coverage gaps and the email-link setup found that
response-list autoscroll can place the start of a tall task or review above the initial
viewport. The important content remains scrollable and the approval action remains
visible, but the user may need to scroll upward to recover context.

## Dependencies

- Issue 14 email-link tracking supplies the long privacy-review case.

## Comments

- 2026-08-25: Long in-place task updates now align their beginning with the message
  viewport while short task and message updates keep bottom anchoring. The regression
  first measured the email-review heading 422 pixels above the viewport, then proved
  it visible and the approval reachable through overlay scrolling. Visual review found
  no unresolved blocker or high-severity issue. `npm run verify` passed 404
  deterministic tests and 61 Chromium journeys.
