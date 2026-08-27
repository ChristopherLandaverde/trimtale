# Implement the Calendly completion adapter

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/29-calendly-completion-adapter.md`

## Summary

Implemented an end-to-end Calendly inline-booking adapter that recognizes one
supported embed, generates a guarded listener plus GA4 event tag, and verifies the
normalized completion in exact GTM Preview.

## Why

Users need to prove a business outcome that occurs inside a cross-origin provider
without reading the provider iframe or retaining private scheduling details.

## Behavior

The current page is eligible only when it has exactly one iframe at the exact
`https://calendly.com` origin with `embed_type=Inline`. The generated DOM Ready
listener resolves that iframe when a message arrives, requires the exact Calendly
origin, iframe source, and `calendly.event_scheduled` event, and emits
`calendly_booking_complete` once without callback fields. A separately reviewable
GA4 event tag fires from that normalized data-layer event. Exact Preview readiness,
explicit approval, validation, immutable version creation, and the existing separate
publication approval remain unchanged.

Direct iframes, popup widgets, multiple embeds, lookalike origins, other providers,
generalized adapter registration, sitewide generation, and fake production-provider
proof remain out of scope.

## Regression coverage

The acceptance fixture and core authoring suite cover URL recognition, generated
listener execution, late iframe injection, origin/source/event guards, one-shot
emission, callback-payload exclusion, setup compilation, and browser-evidence
semantics. Conversation and agent-turn suites cover supported, absent, and ambiguous
page intake. Two Chromium journeys cover the complete managed workflow plus direct
and multiple-embed rejection, including forged origin, wrong source, duplicate, and
private-payload cases.

## Verification

- Focused core suites: 38 tests passed.
- `npm test`: 449 deterministic tests passed.
- Focused Calendly Chromium suite: 2 journeys passed.
- `npm run check`: all workspace builds and typechecks passed.
- `npm run verify`: 449 deterministic tests and 78 Chromium journeys passed.

## Exploratory review

[Calendly completion adapter review](../docs/reviews/2026-08-27-calendly-completion-adapter.md)
covered recognition and review, managed generation, exact Preview verification,
origin/source/duplicate attacks, callback privacy, and unsupported direct or
ambiguous embeds. The listener timing race discovered during implementation was
resolved and permanently covered; no unresolved finding remains.

## Documentation

Updated Issue 29, the executable acceptance fixture, the domain glossary, the setup
engine specification, current capabilities, and the earlier cross-origin discovery
record to distinguish discovery proof from this separately authorized production
adapter.
