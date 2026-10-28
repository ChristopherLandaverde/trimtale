# Guide the complete task journey

Delivery mode: implementation
Status: resolved

## Production outcome

The website agent conducts an existing tracking setup through one visible journey:
Define, Review, Apply, Test, Publish, and Verify. The current stage and one primary
next action remain visible while chat explains the work. Healthy account and container
context collapses to one readable line, while exact plans, receipts, bindings, and
evidence remain available in a separate artifact drawer.

The agent offers at most three contextual starters before the first request, queues a
second prompt while an intake response is pending, and safely stops only that pending
conversation response. Once a durable GTM operation exists, an extension-local,
origin-bound snapshot lets the practitioner return after reload and continue from the
last reviewed boundary without repeating a provider mutation or granting new
authority. A successful live check ends with a clear Live and verified receipt,
copyable summary, and a path to start another setup.

Plan creation remains read-only. One explicit action on the visible exact plan grants
workspace application, one later explicit action on the visible immutable version
grants publication, and one explicit action on the visible failed-version binding
grants rollback. Review-only interstitials do not add redundant confirmation clicks.

## Non-goals

- New tracking types, provider APIs, server persistence, portal workflows, or model
  behavior.
- Automatic application, publication, rollback, or live verification.
- Persisting prompts, form values, cookies, credentials, arbitrary page text, or
  identity data in the resume snapshot.
- Cancelling or steering an in-flight provider mutation whose outcome may already be
  committed.
- Replacing Tag Assistant or changing the exact-preview evidence boundary.

## Authorization

The user authorized continuing the full UX slice on 2026-08-27 after selecting the
guided task journey, resume state, condensed context, artifact drawer, redundant-click
removal, queue controls, and completion experience as the next product focus.

## Regression contract

- `tests/acceptance/guided-task-journey.json` names the six stages, compact-home
  boundary, resumable checkpoints, approval invariants, and forbidden local fields.
- `packages/core/src/guided-task-journey-acceptance.test.ts` schema-validates that
  executable acceptance fixture in the ordinary unit harness.
- `tests/e2e/guided-task-journey.spec.ts` proves the compact healthy context, three
  starters, journey advancement, artifact drawer, prompt queue and safe stop, direct
  exact-plan approval, origin-bound reload resume, and adversarial inert rendering.
- Existing exact-preview, publication, rollback, authentication, and complete-journey
  Chromium tests prove that the presentation change does not widen authority or
  evidence.

## Comments

- 2026-08-27: Claimed after explicit implementation authorization. The slice changes
  presentation and local continuation only; provider and approval contracts remain
  unchanged.
- 2026-08-27: Implemented the six-stage rail, compact context, three starters, artifact
  drawer, sticky primary action, direct exact approvals, safe prompt queue and Stop,
  exact-origin continuation snapshots, and live verified completion receipt.
- 2026-08-27: Exploratory Chromium review resolved three medium hierarchy and queue
  findings. The base-aware documentation check passed with 98 valid records, and
  `npm run verify` passed 463 deterministic tests and 86 Chromium journeys.
