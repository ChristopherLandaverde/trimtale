# Visible custom-metric suggestion review

Date: 2026-08-26

## Environment

- Built production extension in headed managed Chromium.
- Local deterministic API and verification target.
- Controlled configured-model response and managed-workspace plan.
- No real model charge, GA4 action, or Google workspace mutation.

## Scenarios

1. Requested a model alternative for a page-scoped phone interaction and reviewed a
   numeric `lead_score` suggestion requiring an event-scoped GA4 custom metric.
2. Reviewed the prohibited `phone_number` suggestion beside it.
3. Approved the model-authored setup and sent it to durable GTM planning with no
   numeric source available.
4. Kept the private `tel:` value and attacker-shaped link label on the page.

## Observations

- Internal classification tokens are replaced by readable practitioner labels.
- The review identifies `lead_score` as a GA4 custom definition and states that its
  numeric source must be grounded before the metric can be configured.
- The ungrounded suggestion remains visible but is absent from the approved GTM setup;
  no GA4 action is inferred.
- The private phone value and attacker-shaped page text remain absent from the model
  request and durable planning body.
- The metric and prohibited-parameter rows fit in the existing scrollable receipt and
  render as inert text.

## Findings

- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- Focused regression failed before the readable classification mapping and passed
  after the implementation.
- Focused headed Chromium journey passed.
- Capture: `model-authored-setup-review.png` under the focused Playwright result
  directory.
- `npm run verify`: 411 deterministic tests and 70 Chromium journeys passed.
