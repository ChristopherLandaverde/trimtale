# Keep action receipts legible

Delivery mode: implementation
Status: resolved

## Production outcome

Action receipts remain crisp and readable in the compact form-review decision state.
Their card is visually isolated from the glass surface, their smallest text uses a
legible size, and both labels and details meet a readable contrast floor.

## Non-goals

- Changing receipt contents or moving receipts into the artifact drawer.
- Changing the assistant's overall glass treatment.
- Expanding receipt history or provider evidence.

## Authorization

The practitioner reported that Action receipts appeared blurred in the refreshed demo
on 2026-08-27. This is a directly authorized UX correction within the ongoing full UX
slice.

## Regression contract

- `tests/e2e/guided-task-journey.spec.ts` requires the receipt card to remain
  unobscured, use an opaque surface, keep receipt text at least 10 pixels, and maintain
  at least 4.5:1 contrast for the heading, label, and detail in the compact review
  state.
- The reviewed `guided-review-next-action` Chromium baseline records the corrected
  receipt treatment beside the review guidance and action.

## Comments

- 2026-08-27: Claimed from direct visible-demo feedback. Existing coverage protected
  receipt presence and layout but not opacity, text size, or contrast.
- 2026-08-27: Failing-first Chromium coverage reproduced the 9-pixel receipt rows. The
  corrected focused journey passes opacity, 10-pixel minimum, 4.5:1 contrast, overlap,
  and reviewed-baseline checks.
- 2026-08-27: Resolved after all seven affected baselines were reviewed at original
  resolution and `npm run verify` passed 465 deterministic tests and 87 Chromium
  journeys.
