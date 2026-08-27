# Prove one cross-origin callback adapter

Delivery mode: discovery
Status: resolved

## Question

Can one representative embedded provider supply privacy-safe conversion evidence
through a supported callback or validated `postMessage` contract?

## Discovery boundary

Select one provider with authoritative callback documentation. Record its trusted
origin, message schema, completion semantics, duplication behavior, and privacy-safe
fields. Use a narrowly isolated fixture or disposable experiment; do not add a
generalized runtime adapter.

## Non-goals

- Reading cross-origin iframe DOM or private field values.
- Using Custom HTML to bypass the same-origin policy.
- Server-side, mobile, payment attribution, or unrestricted vendor scripts.
- Selecting several providers or creating a broad callback framework.

## Evidence outline

- Accept one trusted completion callback and reject wrong-origin, malformed, repeated,
  and non-conversion messages.
- Normalize only allowlisted metadata into a data-layer event.
- Demonstrate the expected destination request without private payload data.

## Regression contract

- Invariant: only an exact-origin `calendly.event_scheduled` message can produce the
  allowlisted `calendly_booking_complete` data-layer event and one expected GA4
  request; payload fields never enter either artifact.
- Test level: deterministic discovery acceptance proof.
- Fixture: `tests/acceptance/calendly-cross-origin-callback.json`.
- Behavioral test: `packages/core/src/calendly-callback-acceptance.test.ts`.
- Positive case: accept one documented completion message and demonstrate its
  normalized data-layer event and expected destination request.
- Negative cases: reject wrong-origin, malformed, non-completion, and repeated
  messages without emitting another artifact.
- Privacy case: sentinel invitee, URL, and scheduling fields are absent from every
  serialized artifact.

## Comments

- 2026-08-26: Added as discovery because no provider or authoritative callback
  contract has been selected yet.
- 2026-08-27: Selected Calendly's supported JavaScript embed. Its official developer
  guidance documents exact-origin `postMessage` events and
  `calendly.event_scheduled`; the direct-iframe alternative does not support this
  event-tracking path.
- 2026-08-27: The deterministic proof accepts one exact-origin completion, rejects
  wrong-origin, lookalike-origin, malformed, non-completion, and repeat messages, and
  emits one payload-free data-layer event plus its expected GA4 request shape.

## Answer

Yes, for a provider with a supported callback contract. Calendly's advanced JavaScript
embed is a representative proof:

- Trusted origin: exact equality with `https://calendly.com`.
- Message schema used: a record whose `event` field exactly equals
  `calendly.event_scheduled`; no payload field is required or retained.
- Completion semantics: the documented scheduled-event message means the booking
  completed. Earlier profile, event-type, and date/time events are not conversions.
- Duplication behavior: the provider does not document an exactly-once guarantee, so
  the consumer accepts only the first completion during one page lifecycle.
- Privacy-safe normalization: `{ "event": "calendly_booking_complete" }`.
- Expected destination evidence: one GA4 `calendly_booking_complete` request with the
  `page_location` parameter name present and no callback payload values.

This proves a provider-specific adapter is feasible. It does not make arbitrary
cross-origin iframes observable. A future production adapter must additionally bind
the message source to the expected widget instance, preserve the exact-origin and
exact-event checks, and keep the payload allowlist empty unless separately justified.
No runtime adapter, generated Custom HTML, or generalized callback framework was added.
