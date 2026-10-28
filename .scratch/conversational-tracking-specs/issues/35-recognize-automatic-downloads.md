# Recognize automatic download coverage

Delivery mode: implementation
Status: resolved

## Problem

Typing `track downloads` currently produces the generic unknown-intent response even
when one exact GA4 stream already has automatic file-download measurement active.

## Production outcome

Recognize a download-tracking request and use the existing enhanced-measurement audit:

- Report `Already covered` when the master switch and file downloads are on.
- Offer browser verification of a real file link instead of generating duplicate GTM.
- Report the exact automatic-coverage gap when either setting is off.
- Refuse a coverage claim without one exact recognized GA4 stream.

## Non-goals

- Do not add a custom GTM download generator in this slice.
- Do not claim coverage without one exact recognized GA4 stream.
- Do not treat a link labelled “Download” as a file download without a supported file
  extension.
- Do not expand all enhanced-measurement intents from this one example.

## Authorization

On 2026-08-24, after selecting request → coverage decision → recommended action as the
next vertical slice, the user said “continue on.”

## Regression contract

- Invariant: download language produces a bounded file-download decision and never a
  custom GTM proposal.
- Unit: `packages/core/src/conversation.test.ts` covers recognized and unrelated
  language.
- Unit: `packages/core/src/agent-turn.test.ts` covers already-on, master-off,
  file-downloads-off, and missing-exact-stream decisions.
- Browser: `tests/e2e/gtm-connection-context.spec.ts` submits `track downloads` through
  the visible workbench and proves the already-covered result has no setup-generation
  action.

## Comments

- 2026-08-23: Live ConsentFlow proof produced an accepted `file_download` request for
  `G-YV879ECLRV`; the remaining gap is product recognition, not GA4 collection.
- 2026-08-24: Focused unit tests and the visible Chromium journey pass. Covered streams
  produce no GTM action; disabled download coverage and attacker-shaped intake remain
  bounded.
- 2026-08-24: `npm run verify` passed 290 deterministic tests and 51 Chromium
  journeys. The regression contract is complete.
