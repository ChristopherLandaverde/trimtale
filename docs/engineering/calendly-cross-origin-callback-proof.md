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

## Production follow-up

Issue 29 separately authorized and implemented the first production adapter. It
recognizes one current-page Calendly iframe only when the exact origin and Calendly's
generated `embed_type=Inline` marker are present. The generated Custom HTML listener
resolves the single frame when a message arrives, binds `MessageEvent.source`, retains
the exact origin and event checks, accepts the first completion only, and keeps the
payload allowlist empty. A second GA4 tag fires from the normalized data-layer event.

The website agent exposes provider, source, consent, page scope, event, exclusions,
and real-booking Preview proof before setup approval. The existing managed-workspace,
exact Preview, immutable version, and publication checkpoints remain unchanged.

This does not generalize to a provider that lacks an authoritative callback or
validated `postMessage` contract. It does not read iframe DOM, collect form values, or
bypass the same-origin policy.
