# Prove a Calendly cross-origin callback

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/26-cross-origin-callback-proof.md`

## Summary

Selected Calendly as the representative cross-origin provider and added an isolated,
deterministic proof of its supported completion-message boundary.

## Why

Cross-origin embeds cannot be verified through DOM inspection. The product needs
evidence that one authoritative provider callback can safely represent a completed
conversion before any runtime adapter is proposed.

## Behavior

The discovery proof accepts one exact-origin `calendly.event_scheduled` message,
normalizes a payload-free data-layer event, and demonstrates the expected GA4 request
shape. It rejects wrong and lookalike origins, malformed and non-completion messages,
and repeat completion messages. No production receiver, generated tag, callback
framework, or user-visible workflow was added.

## Regression coverage

`packages/core/src/calendly-callback-acceptance.test.ts` consumes
`tests/acceptance/calendly-cross-origin-callback.json`. The proof executes every
positive and negative case and verifies that private payload sentinels never enter the
data-layer or request artifacts.

## Verification

- Focused callback acceptance proof: 2 tests passed.
- `npm run verify`: 444 deterministic tests and 76 Chromium journeys passed.

## Exploratory review

Interactive review is not applicable because this is a test-only discovery proof with
no runtime or user-visible surface.

## Documentation

Resolved Issue 26, updated the setup-engine optimization backlog, and added the
engineering discovery note.
