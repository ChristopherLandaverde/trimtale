# GA4 definitions and key-event configuration

Delivery mode: implementation
Status: in progress

## Production outcome

The agent reviews and explicitly applies bounded GA4 changes for Enhanced Measurement,
event-scoped custom definitions, custom metrics, and key events while keeping GA4
state independent from GTM state.

## Non-goals

- GA4 reporting, audience, attribution, or advertising configuration.
- Implicit GA4 writes following from a GTM plan.
- Event-level receipt identity.

## Authorization

The user selected GTM and GA4 as the Stage 1 provider boundary, retained custom
definitions and key events, and authorized continuous Stage 1 implementation on
2026-08-24.

## Regression contract

- Required, recommended, predefined, custom, unavailable, and prohibited parameters
  produce distinct review states.
- `packages/core/src/ga4-configuration.test.ts` proves custom-definition and key-event
  writes require exact property targets, fresh-state fingerprints, explicit approval,
  and independent action receipts.
- `tests/e2e/ga4-configuration.spec.ts` proves a confirmed lead setup can separately
  review and approve the exact GA4 property actions, makes no GTM workflow request,
  renders validated receipts, and fails closed on fresh-state drift.
- GTM changes never infer GA4 changes and GA4 changes never infer GTM changes.

## Dependencies

- Issues 01 and 04.

## Implemented checkpoint

- A confirmed `generate_lead` setup can request a separate plan for the `form_name`
  event-scoped custom dimension and `generate_lead` key event when Analytics writes
  are explicitly enabled for the exact connected stream.
- Chat displays the exact property, stream, measurement ID, and actions before one
  explicit apply approval. The backend creates the approval, fresh-reads provider
  state, and validates every returned action receipt against the reviewed plan.
- Planning and application make no GTM workflow request. Stale provider state,
  disabled writes, malformed responses, and provider failures make no success claim.
- Model-authored reviews translate internal suggestion classes into practitioner-facing
  labels. A representative numeric `lead_score` suggestion is identified as requiring
  a GA4 custom definition, while its missing grounded value keeps it out of the GTM
  setup and prevents any inferred GA4 action.

## Remaining work

- Replace the actor class `website_chat_human` with signed-in organization identity.
- Exercise the exact actions against a disposable authenticated GA4 property.

## Comments

- 2026-08-26: Added the visible confirmed-lead GA4 plan and apply path with separate
  approval, fresh-state enforcement, validated receipts, and continuation back to the
  GTM workflow. Chromium covers passing, stale, and attacker-shaped page input. The
  issue remains open for visible custom-metric authoring, product identity, and a real
  disposable-property exercise.
- 2026-08-26: Exposed a readable event-scoped custom-metric suggestion in the visible
  model-authored review. The regression proves the ungrounded numeric parameter does
  not enter the confirmed GTM setup or trigger a GA4 write. Issue 07 remains open for
  signed-in organization identity and disposable-property interoperability.
