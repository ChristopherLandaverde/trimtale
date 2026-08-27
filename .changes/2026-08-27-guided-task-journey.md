# Guide the complete task journey

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/32-guided-task-journey.md`

## Summary

The website agent now conducts tracking setup through six visible stages with compact
context, focused primary actions, separate task details, safe prompt queueing, and an
exact-origin reload continuation.

## Why

Practitioners need one understandable path from intent to verified live measurement
without losing evidence, repeating completed work, or clicking review-only
interstitials that grant no new authority.

## Behavior

Recognized connection context is condensed, the welcome offers three starters, the
current stage and primary action remain visible, and detailed artifacts move into a
drawer. A pending conversation response accepts queued prompts and can be stopped
without cancelling provider work. Supported reviewed checkpoints resume from a
privacy-filtered extension-local snapshot bound to the exact page origin. Live success
produces a copyable receipt and clears that snapshot.

One visible exact-plan action still grants application, one later immutable-version
action still grants publication, and one failed-version action still grants rollback.
Plan creation remains read-only. Provider APIs, server persistence, tracking types,
automatic mutation, and Tag Assistant evidence boundaries are unchanged and out of
scope.

## Regression coverage

`tests/acceptance/guided-task-journey.json` and
`packages/core/src/guided-task-journey-acceptance.test.ts` validate the accepted stage,
approval, queue, privacy, artifact, and completion contract.
`tests/e2e/guided-task-journey.spec.ts` covers the compact and adversarial home, queue
dispatch, Stop behavior, task details, exact-origin reload, storage privacy, and no
accidental application. Existing exact-preview, version, publication, rollback,
authentication, connection, and complete-journey suites continue to protect their
authority and evidence boundaries.

The authenticated, connection, navigation, verification, artifact-drawer, and
resume-card Chromium baselines were intentionally replaced or added after visual
review. Assertions that previously required now-removed review-only interstitials were
updated to exercise the visible exact approval directly; no approval boundary was
removed.

## Verification

- Focused regression and visual-baseline journeys: passed.
- Complete browser suite before final polish: 85 journeys passed.
- Base-aware change-documentation check: 98 records valid.
- Final `npm run verify`: 463 deterministic tests and 86 Chromium journeys passed.

## Exploratory review

See `docs/reviews/2026-08-27-guided-task-journey.md`. Compact home, complete task,
reload, unavailable/wrong-origin, queued-response, and attacker-shaped states were
reviewed. Three medium findings were fixed with permanent regressions; no unresolved
finding remains.

## Documentation

Updated the setup-engine specification, current capabilities, Issue 32, and the guided
task journey review.
