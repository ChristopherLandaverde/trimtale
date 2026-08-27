# Keep verification targets operable

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/23-clear-verification-target-controls.md`

## Summary

Browser runs now center the confirmed target and replace the expanded website agent
with a compact visible verification dock until evidence is ready.

## Why

The real Stage 1 review found that the expanded agent and a sticky page header could
cover a confirmed form control in a narrow Tag Assistant target viewport.

## Behavior

Form and known-interaction verification use the same transient compact presentation.
The target, durable operation, evidence rules, GTM visibility threshold, and approval
gates are unchanged. The agent does not submit a form or read its values.

## Regression coverage

`tests/e2e/conversational-form.spec.ts` places the confirmed form behind a sticky
header in a 700-by-560 viewport, requires the 166-by-50 active dock, proves the submit
button is the ordinary pointer target, completes exact versioning, and excludes a
private sentinel from durable evidence. Existing form journeys now require the compact
active state before submission.

## Verification

- Focused narrow-viewport journey: passed.
- Complete `conversational-form.spec.ts`: 18 journeys passed.
- `npm run verify`: 421 deterministic tests and 74 Chromium journeys passed.

## Exploratory review

See `docs/reviews/2026-08-27-clear-verification-target-controls.md`.

## Documentation

Updated the active setup-engine specification, current capabilities, and Issue 23.
