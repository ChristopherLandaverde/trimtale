# Connect model-authored setup review

Delivery mode: implementation
Status: resolved

## Production outcome

A practitioner may ask the configured setup-authoring model for an alternative event
contract grounded in one confirmed known interaction, review its classified parameter
suggestions, approve the resulting schema-valid setup, and send that setup through the
ordinary durable managed-workspace runner.

## Non-goals

- Model-supplied selectors, evidence, mutation, approval, or publication authority.
- Sending private interaction values or arbitrary page text to the model.
- Replacing deterministic known-interaction setup.
- Automatic model calls.

## Authorization

The user explicitly selected this implementation workflow on 2026-08-26.

## Regression contract

- `tests/e2e/conversation-intake.spec.ts` proves the call is explicit, the proposal and
  classifications are visible, approval is separate, the confirmed model-authored
  setup enters durable planning, and private page values remain excluded.
- Existing setup-authoring contract and provider tests continue to reject invented
  grounding, selectors, evidence, authority, and prohibited values.

## Dependencies

- Issue 04 model-backed authoring foundation.
- Issue 10 visible generic interaction authoring.

## Comments

- 2026-08-26: Connected the protected setup-authoring provider to an explicit visible
  alternative action, reviewable event/rationale/parameter receipt, separate setup
  approval, and the existing durable generic-setup runner. Private phone values and
  attacker-shaped page text remain outside both authoring and planning bodies.
  `npm run verify` passed 411 deterministic tests and 64 Chromium journeys; headed
  exploratory review found and resolved the receipt-order issue with no remaining
  finding.
