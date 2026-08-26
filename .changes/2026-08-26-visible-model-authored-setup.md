# Connect visible model-authored setup

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/16-visible-model-authored-setup.md`

## Summary

Let a practitioner explicitly request, review, and approve one privacy-filtered
model-authored alternative for a confirmed known interaction, then send the confirmed
setup through the ordinary durable managed-workspace planner.

## Why

The protected authoring provider already returned schema-valid setups, but no visible
product workflow exposed its bounded proposal and parameter classifications or proved
that the approved result used the existing deterministic runner.

## Behavior

The deterministic known-interaction review now offers an optional model alternative.
The visible receipt names the event, configured provider, rationale, and parameter
classifications before a separate approval. Only the confirmed schema-valid setup
enters deterministic planning. Model-supplied selectors, evidence, provider actions,
approval, publication, private interaction values, and arbitrary page text remain
excluded. The call is never automatic.

## Regression coverage

`tests/e2e/conversation-intake.spec.ts` covers the explicit call, visible and
scrollable review receipt, separate setup approval, durable planning request, and
exclusion of a private phone value and attacker-shaped page text. Existing
`packages/core/src/setup-authoring.test.ts` and
`apps/api/src/openai-setup-authoring-provider.test.ts` continue to enforce the
authoring and authority contracts.

## Verification

`npm run verify` passed preflight and documentation checks, all workspace typechecks,
411 deterministic tests across 51 files, all builds, and 64 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-visible-model-authored-setup.md`. Headed Chromium covered
the normal alternative, unavailable deterministic fallback, private value, and
attacker-shaped label. The initial receipt-order finding was fixed and protected with
an in-viewport assertion. No unresolved finding remains.

## Documentation

Updated the setup-engine issue, acceptance state, Stage 1 handoff, and implementation
progress record.
