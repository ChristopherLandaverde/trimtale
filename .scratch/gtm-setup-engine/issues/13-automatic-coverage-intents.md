# Recognize automatic-coverage intents

Delivery mode: implementation
Status: resolved

## Production outcome

From the website agent, a practitioner can ask about page views, scrolls, site search,
or video engagement. The agent uses Enhanced-measurement coverage from one exact GA4
web stream to report that the interaction is already covered or name the exact gap.

## Non-goals

- Creating fallback GTM tags for these interactions.
- Changing Enhanced Measurement or requesting Analytics edit access.
- Exercising scroll, search, or video interactions in the browser.
- Treating automatic events as conversion outcomes.
- Email links, CTA selection, portal work, or a generalized coverage framework.

## Authorization

The user approved continuing with the recommended low-complexity sequence on
2026-08-25 after reviewing the behavior, performance posture, and boundaries.

## Regression contract

- `packages/core/src/conversation.test.ts` proves precise page-view, scroll,
  site-search, and video-engagement classification without capturing unrelated uses of
  “view” or “search.”
- `packages/core/src/agent-turn.test.ts` proves exact-stream covered, feature-off,
  master-off, and unavailable-audit decisions without setup or mutation actions.
- `tests/acceptance/conversation-intake.json` records all four intake states.
- `tests/e2e/automatic-coverage-intents.spec.ts` proves visible covered and gap states,
  no setup actions, and bounded attacker-shaped page content.

## Dependencies

- Conversational-spec issue 32 Enhanced-measurement readiness.
- Conversational-spec issue 33 visible automatic coverage.

## Comments

- 2026-08-25: Added four acceptance cases, precise deterministic intake, exact-stream
  covered/gap/unavailable decisions, and three built-extension journeys. Exploratory
  review corrected misleading setup-oriented plan labels and found no unresolved
  blocker or high-severity issue. `npm run verify` passed 399 deterministic tests and
  58 Chromium journeys; all builds, typechecks, preflight checks, and 66 change records
  passed.
