# Connect generation, browser verification, and GA4 evidence

Status: active

## Objective

On an exactly recognized GTM/GA4 page, carry the authenticated context through setup
generation, a guided browser run, and read-only GA4 platform evidence instead of
leaving three independent pending stages.

## Regression contract

### Connected setup generation

- Exact GTM recognition returns only safe account/container identity and the sorted,
  unique GA4 measurement IDs extracted from the live container version.
- One measurement ID plus one exact container match supplies account ID, container ID,
  public ID, container name, and measurement ID to navigation and form generators.
- Page-owned proprietary meta tags remain a deterministic-fixture fallback only.
- Zero or multiple live measurement IDs remain unresolved; the assistant never guesses.
- Generation remains read-only and does not require GTM edit or publication capability.

### Browser verification

- The evidence path retains named stage handles for the confirmed specification.
- Starting verification changes the browser stage to waiting.
- A passed verdict marks Browser verification passed in the same evidence path.
- Failed or inconclusive evidence marks the stage failed/inconclusive with the safe next
  action; it never remains falsely pending.
- An already published setup can be verified without generating or installing another
  copy.

### GA4 platform evidence

- Analytics calls require a separate exact backend enable flag and the least-privilege
  `analytics.readonly` OAuth scope; the saved broader edit scope is never used for a
  write.
- The Analytics Admin API must map one measurement ID to exactly one accessible GA4
  property/data stream. Zero or multiple matches fail closed.
- Starting the guided run records a server-side baseline Realtime `eventCount` for the
  selected event before submission and returns an opaque, expiring verification ID.
- Platform confirmation is eligible only after browser verification passes.
- Confirmation passes only when the same property's Realtime event count increases
  above the baseline after the run starts. Equal/decreased counts remain pending.
- The UI states that this is aggregate before/after correlation, not event-level or
  user-level proof.
- Opaque verification state is bounded, expiring, non-durable, and contains no field
  values, cookies, access tokens, or submitted personal information.

### Failure states

- Analytics disabled, disconnected, inaccessible property, ambiguous stream, baseline
  unavailable, confirmation pending, expired verification, malformed API payload, and
  local-service offline remain distinct safe outcomes.
- Raw Google bodies, tokens, browser cookies, form values, and private backend errors
  never render or persist.
- No GTM/GA4 write or publication endpoint is called.

## Work

- Add safe measurement-destination extraction to GTM inspection.
- Add a read-only Analytics client and fixed start/confirm endpoints.
- Extend the service-worker bridge and strict content-side decoders.
- Persist recognized context and evidence-stage handles inside the page session.
- Use connected context for both generators and update browser/platform rows in place.
- Add backend, Chromium, privacy, visual, and live disposable-property review evidence.

## Done when

- The live ConsentFlow flow generates against `GTM-PCJ3Q5RK` / `G-YV879ECLRV`
  without proprietary page meta tags.
- One guided successful submission updates browser evidence and can advance GA4
  aggregate platform evidence through read-only APIs.
- Ambiguity, latency, and failure remain honest and retryable.
- Full local, exact-base, GitHub CI, and merge gates pass.

## Comments

- 2026-08-23: Claimed after the pre-chat card proved exact GTM identity while the
  downstream generation and evidence stages remained disconnected. Credential-safe
  inspection verified `analytics.readonly`; Analytics Admin read access found exact
  property `properties/550074997`, stream `properties/550074997/dataStreams/15443100029`,
  and measurement ID `G-YV879ECLRV`.
- 2026-08-23: Implemented exact measurement extraction, connected generation,
  stateful browser/platform rows, a separately gated read-only Analytics client, and
  permanent unit plus Chromium regressions. Deterministic happy, provider-denied, and
  attacker-shaped paths pass. Live setup generation and browser verification now pass;
  the accepted HTTP 204 browser event has not yet appeared in GA4 Realtime, so the
  external live platform criterion remains open and this issue is not resolved.
- 2026-08-23: An unfiltered read-only Realtime report returned `rowCount: 0`; the
  external blocker affects the entire disposable property, not only the exact
  `generate_lead` filter. Browser collection returned HTTP 204 with the expected
  destination and parameters. No additional submission should be used merely to outrun
  ingestion latency.
