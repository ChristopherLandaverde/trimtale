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
- GTM changes never infer GA4 changes and GA4 changes never infer GTM changes.

## Dependencies

- Issues 01 and 04.
