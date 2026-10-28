# Observe visible-success DOM changes

Delivery mode: implementation
Status: in progress

## Production outcome

Element Visibility triggers generated from confirmed visible success evidence use
GTM's canonical parameter contract and enable DOM-change observation so an initially
hidden success element can fire when the website reveals it after submission.

## Non-goals

- Replacing visible success evidence with a custom data-layer event.
- General inference or automatic rewriting from every failed browser verdict.
- Publication without the existing exact preview and version approval gates.

## Authorization

The user authorized continuous Stage 1 implementation and asked the agent to continue
the credentialed workflow. The real exact-preview run exposed this compiler defect
inside Issue 06's accepted bounded-repair outcome.

## Regression contract

`packages/core/src/form-generator.test.ts` requires generated visible-element success
triggers to use the canonical selector, ratio, duration, DOM-listener, and frequency
keys and rejects the provider-accepted aliases. Existing compiler and semantic
planning tests must remain green.

## Progress

- 2026-08-26: Real Tag Assistant preview observed
  `gtm_observability_smoke_success`, but `GA4 Event - generate_lead` remained under
  Tags Not Fired. The operation recorded `no_known_repair` and created no version.
- 2026-08-26: Added the failing compiler regression, then the missing GTM trigger
  parameter. Focused generator, compiler, and planner tests pass.
- 2026-08-26: `npm run verify` passes with 419 deterministic tests and 71 Chromium
  journeys.
- 2026-08-26: Exact managed-replacement review showed the proposed DOM-listener
  field. Google accepted the replacement, provider validation passed, and exact
  preview `1787791960566` was bound.
- 2026-08-26: A fresh supported Tag Assistant connection still did not fire the tag.
  GTM's rendered editor showed an empty ID selector. Its control model exposed the
  canonical keys: `selectorType`, `elementSelector`, `onScreenRatio`,
  `useOnScreenDuration`, and `useDomChangeListener`; the once-per-page enum is
  `ONCE`. A replacement regression failed on every alias, then all 26 focused
  generator, compiler, and planner tests passed after the complete correction.
- 2026-08-26: `npm run verify` passes with 419 deterministic tests and 71 Chromium
  journeys. A focused headed adversarial journey also passes.
- 2026-08-26: Exact preview `1787793264804` emitted `gtm.elementVisibility`, fired
  `GA4 Event - generate_lead`, observed one matching GA4 request, and bound exact
  browser evidence. Issue 20 owns the separate version-gate defect found next; no
  version or publication was created.
