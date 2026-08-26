# Low-effort link interactions

Delivery mode: implementation
Status: resolved

## Production outcome

From the website agent, a practitioner can request outbound-link or file-download
tracking. The agent counts eligible links without exposing their destinations, avoids
creating duplicate GTM events when the exact GA4 stream already supplies Enhanced
Measurement coverage, and otherwise produces a scoped, privacy-safe tracking setup
that enters the ordinary managed-workspace and exact-preview workflow.

## Non-goals

- Treating a click or download as a conversion outcome.
- Sending destination URLs, query strings, link text, or file names to GA4 by default.
- CTA/button selection, email links, SPA routes, element visibility, or Custom HTML.
- Changing Enhanced Measurement automatically or moving setup into the portal.
- Adding event-specific workflow branches outside the shared interaction recipe.

## Authorization

The user authorized the outbound-link and file-download slice on 2026-08-25 after
reviewing its behavior and non-goals.

## Regression contract

- `packages/core/src/interaction-authoring.test.ts` proves both recipes' event names,
  selectors and conditions, consent, scope, verification expectations, and parameter
  exclusions.
- `packages/core/src/conversation.test.ts` proves exact intent classification, safe
  observed-count grounding, and the no-evidence boundary.
- `packages/core/src/agent-turn.test.ts` proves exact-stream automatic coverage blocks
  duplicate setup while missing or disabled coverage offers the shared setup path.
- `tests/e2e/known-link-interactions.spec.ts` proves visible outbound and download
  intake, scope, privacy review, setup generation, automatic-coverage behavior, and an
  attacker-shaped destination that never appears in the assistant state or artifact.

## Dependencies

- Issue 10 shared known-interaction authoring.
- Issue 07 Enhanced Measurement coverage.

## Comments

- 2026-08-25: Core classification, bounded discovery, recipe compilation, privacy,
  and coverage decisions pass 25 focused tests. All 392 repository unit tests pass.
- 2026-08-25: Three new Chromium journeys pass for outbound setup and planning,
  download fallback setup, automatic-coverage deduplication, missing evidence, and
  attacker-shaped destinations. The pre-existing automatic-download journey passes
  with explicit page evidence.
- 2026-08-25: Headed exploratory review found no blocker or high-severity product
  finding. The issue remains in progress because the required full gate has an
  unrelated, reproducible form-highlight snapshot mismatch tracked in the reopened
  conversational-spec issue 12. No visual baseline was changed.
- 2026-08-25: The visual follow-up was resolved. Final `npm run verify` passed all 392
  deterministic tests and 55 Chromium journeys, including the three new link journeys
  and the existing automatic-download decision.
