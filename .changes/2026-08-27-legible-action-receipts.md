# Keep action receipts legible

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/36-keep-action-receipts-legible.md`

## Summary

Action receipts now use a crisp opaque card, larger text, and higher-contrast labels
and details in the compact website-agent journey.

## Why

The refreshed interactive demo exposed that the small muted receipt text and
translucent card appeared blurred against the assistant's glass surface.

## Behavior

Receipt headings and rows use at least 10-pixel type. The card is isolated from the
glass treatment with an opaque surface and subtle border, while each text role exceeds
a 4.5:1 contrast floor. Receipt contents, history, provider evidence, and placement are
unchanged.

## Regression coverage

`tests/e2e/guided-task-journey.spec.ts` now checks the receipt hit target, opaque
background, heading and row sizes, and computed heading, label, and detail contrast in
the compact review state. The contextual-confirmation and review-next-action Chromium
baselines were intentionally updated after full-resolution visual review.

## Verification

- Failing-first compact journey: reproduced 9-pixel receipt rows.
- Corrected focused journey with updated reviewed baselines: passed.
- Four additional shared receipt journeys with five reviewed baselines: passed.
- Final `npm run verify`: 465 deterministic tests and 87 Chromium journeys passed.

## Exploratory review

See `docs/reviews/2026-08-27-legible-action-receipts.md`. The compact review,
ambiguous-target, and inert attacker-shaped context states were reviewed. No unresolved
finding remains.

## Documentation

Updated the setup-engine acceptance criteria, current capabilities, Issue 36, and the
exploratory review.
