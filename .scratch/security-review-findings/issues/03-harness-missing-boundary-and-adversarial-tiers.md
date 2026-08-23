# Delivery harness has no regression tier for boundary defaults or adversarial input

Status: open

## Objective

Issues 01 and 02 in this same directory are two real bugs
(`01-api-cors-wildcard-default.md`, `02-content-script-innerhtml-xss.md` —
02 is now fixed). Looking at why each slipped through
`docs/engineering/delivery-harness.md`'s existing regression tiers explains
two gaps in the harness document itself, not just in the two features:

1. The regression tiers (Contract, Domain/verdict, Generator, Conversation,
   Privacy/security, Browser/site, UX/accessibility, Reliability/performance)
   never mention server/extension **boundary configuration** — CORS origin,
   host binding, or any behavior gated by an environment variable that can
   silently default to permissive. The privacy/security tier only covers data
   (form values, cookies, credentials, page text) not entering messages, logs,
   or persistence — it says nothing about a boundary defaulting open. That's
   exactly how the CORS wildcard default (issue 01) passed every existing
   invariant: there was no invariant it violated.
2. The exploratory Chromium review checklist
   (`docs/engineering/delivery-harness.md`, "Exploratory Chromium review"
   section, step 3) requires exercising "at least one ambiguous, negative,
   unsupported, or insufficient-evidence path" but never requires exercising
   an **adversarial** path — a page actively trying to break the extension,
   as opposed to a page the assistant merely doesn't understand. That's the
   gap that let the `innerHTML` sink in the content script (issue 02) go
   unexercised for as long as it did.

## Regression contract

This is a documentation/process change with no executable behavior of its own;
per `docs/engineering/delivery-harness.md`'s own "Progress without ceremony"
section, documentation-only edits do not require a change record or browser
run unless they alter executable examples. No new test file is required here.
The contract instead is: the next feature whose regression contract lists one
of the two tiers below must actually exercise it, which is verifiable by
inspecting future issue files' `## Regression contract` sections.

## Work

- Add a "Boundary and configuration regressions" tier to
  `docs/engineering/delivery-harness.md`'s regression-tiers list: any
  server or extension boundary gated by an environment variable, origin
  check, or host binding must have a test proving the unconfigured/default
  state fails closed, not open.
- Extend the "Exploratory Chromium review" checklist's step 3 to require
  exercising at least one adversarial page (a page that supplies
  attacker-shaped input — markup-bearing text, oversized payloads, malformed
  selectors — not merely an ambiguous or unsupported one).
- Add both new tiers to the "Test placement" table if a natural location
  applies (e.g. boundary/config tests under `apps/api/src/*.test.ts` and
  `apps/extension/src/*.test.ts` alongside their existing entries).

## Done when

- `docs/engineering/delivery-harness.md` documents both additions.
- `AGENTS.md` still accurately points to the updated document (no changes
  expected there unless the summary in `AGENTS.md` itself goes stale).
