# Calendly cross-origin callback proof

Recorded: 2026-08-27

## Result

A supported provider callback can supply privacy-safe conversion evidence for an
otherwise inaccessible cross-origin embed. This result applies to Calendly's standard
or advanced JavaScript embed, not to arbitrary iframes.

Calendly's [advanced embed documentation](https://calendly.com/help/advanced-calendly-embed-for-developers)
documents `window.postMessage`, the exact `https://calendly.com` origin check, and four
event names. Only `calendly.event_scheduled` represents a completed booking. The same
documentation says its direct-iframe alternative does not support event tracking via
`postMessage`.

## Proven boundary

The isolated acceptance proof applies these rules:

1. Require exact origin equality; suffix, substring, and lookalike matches are unsafe.
2. Require a record with the exact `calendly.event_scheduled` event name.
3. Accept the first completion during one page lifecycle and reject repeats because
   Calendly does not document an exactly-once delivery guarantee.
4. Discard the provider payload. Normalize only
   `{ "event": "calendly_booking_complete" }`.
5. Demonstrate one expected GA4 request shape using only the event name and required
   parameter names. Invitee, event URI, email, and time sentinels do not enter emitted
   artifacts.

The fixture is `tests/acceptance/calendly-cross-origin-callback.json`; its deterministic
receiver proof is `packages/core/src/calendly-callback-acceptance.test.ts`.

## Production implication

A future Calendly adapter is viable, but this discovery does not authorize one. A
production receiver would also need to bind `MessageEvent.source` to the expected
widget instance so another Calendly embed on the same page cannot satisfy the signal.
It must retain exact origin and event matching, first-completion deduplication, and the
empty payload allowlist.

This does not generalize to a provider that lacks an authoritative callback or
validated `postMessage` contract. It does not read iframe DOM, collect form values, or
bypass the same-origin policy.
