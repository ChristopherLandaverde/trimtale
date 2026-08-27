# Prove one cross-origin callback adapter

Delivery mode: discovery
Status: open

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

## Comments

- 2026-08-26: Added as discovery because no provider or authoritative callback
  contract has been selected yet.
