# Explain the form review action

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/35-explain-review-next-action.md`

## Summary

The form journey now explains the read-only review and offers `Review what will be
tracked` instead of the generic `Review setup` action.

## Why

The fresh interactive demo exposed a decision state that supplied an action label but
not enough visible context for the practitioner to predict its contents or safety
boundary.

## Behavior

After one form and its success signal are confirmed, the compact next-action area names
the form, signal, event, and privacy boundary that the review contains. It explicitly
states that nothing will be created yet. The review remains read-only and setup
approval remains a separate explicit action.

Known-link and provider-specific review actions, setup contents, supported intents,
provider authority, application, publication, rollback, and evidence rules are
unchanged.

## Regression coverage

`tests/e2e/guided-task-journey.spec.ts` now requires the rationale, safety boundary,
descriptive action, and usable composer to appear together below the sticky journey
rail. Its new `guided-review-next-action` Chromium baseline records the complete
decision state. Existing form journeys were updated to use the descriptive action.

## Verification

- Failing-first focused Chromium journey: reproduced the missing action and context.
- Corrected focused Chromium journey with composer hit testing: passed.
- Focused GA4 configuration journeys: two passed.
- Final `npm run verify`: 465 deterministic tests and 87 Chromium journeys passed.

## Exploratory review

See `docs/reviews/2026-08-27-explain-review-next-action.md`. The compact form review,
ambiguous target, explicit approval, and attacker-shaped connection context were
reviewed. No unresolved finding remains.

## Documentation

Updated the setup-engine acceptance criteria, current capabilities, Issue 35, and the
exploratory review.
