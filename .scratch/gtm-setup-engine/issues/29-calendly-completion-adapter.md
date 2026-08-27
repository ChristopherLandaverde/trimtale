# Implement one Calendly completion adapter

Delivery mode: implementation
Status: completed

## Decision

Support exactly one Calendly inline embed observed on the current page. Recognition
requires an iframe whose origin is exactly `https://calendly.com` and whose generated
URL contains `embed_type=Inline`. This covers Calendly's standard inline widget and
advanced `initInlineWidget` output while excluding the documented direct-iframe
alternative.

The generated tracking setup contains two separately reviewable actions:

1. A Custom HTML listener firing on DOM Ready for the current page. It binds the
   message source to the single recognized iframe, accepts the exact origin and exact
   `calendly.event_scheduled` event once, discards the payload, and pushes only
   `{ event: "calendly_booking_complete" }`.
2. A GA4 event tag firing on that custom data-layer event with no callback-derived
   parameters.

Preview verification starts only after the existing exact-preview readiness gate. A
real Calendly test booking must produce both the normalized data-layer event and one
matching GA4 request. Local fixtures may inject origin-accurate provider messages for
deterministic tests but are never presented as real-provider evidence.

## Non-goals

- Direct iframes, popup widgets, multiple Calendly embeds, or other providers.
- Reading iframe DOM, form fields, invitee details, event URIs, or callback payloads.
- A generalized provider-adapter registry or callback framework.
- Fake production provider proof, GA4 reporting claims, or publication without the
  existing exact approval.
- Sitewide generation or automatic selection when the page has multiple supported
  embeds.

## Regression contract

- Invariant: only one recognized Calendly inline iframe can produce the listener plus
  GA4 setup, and only one exact-origin, exact-source, exact-event completion can emit
  the payload-free normalized event.
- Contract fixture: `tests/acceptance/calendly-completion-adapter.json`.
- Core behavior: `packages/core/src/calendly-authoring.test.ts` validates recognition,
  generated code execution, privacy, setup semantics, and compiled GTM entities.
- Browser journey: `tests/e2e/calendly-completion-adapter.spec.ts` covers visible
  detection, review, managed planning, exact Preview, wrong-origin/source rejection,
  a valid completion, one GA4 request, and duplicate suppression.
- Negative recognition cases: direct iframe, popup output, lookalike origin, malformed
  URL, no embed, and multiple inline embeds produce no setup.
- Privacy case: invitee email, event URI, and scheduling-time sentinels never enter the
  generated code, setup artifacts, browser evidence, or visible UI. The current page
  query is absent from generated setup artifacts; GA4 may still collect it through its
  automatic `page_location` parameter.

## Authorization

The user explicitly authorized this production Calendly adapter on 2026-08-27 after
reviewing its exact behavior and non-goals.

## Comments

- 2026-08-27: Issue 26 proved the supported Calendly completion-message boundary in
  an isolated discovery fixture. This issue owns the separately authorized runtime
  implementation.
- 2026-08-27: Implementation generates the guarded listener and GA4 event tag,
  integrates provider-completion browser evidence with the existing managed workflow,
  and blocks absent, direct, or ambiguous embeds.
- 2026-08-27: Exploratory review found and resolved a late-injected-iframe timing race;
  the production listener now resolves the exact recognized source at message time.
- 2026-08-27: Final verification passed with 449 deterministic tests and 78 Chromium
  journeys. The focused Calendly review has no unresolved finding.
