# Add the intake evaluation report UI

Status: resolved

## Objective

Give the practitioner a clear, read-only model-evaluation panel inside the existing
tracking assistant, with visible empty, passing, degraded, inconclusive, malformed,
and unavailable states that never offer or imply model execution or GTM authority.

## Regression contract

Required test level:

- Runtime response-decoder and view-state tests in
  `apps/extension/src/intake-evaluation-view.test.ts` under `npm test`.
- Complete built-extension journeys and visual baselines in
  `tests/e2e/intake-evaluation-ui.spec.ts`.

Required fixtures and cases:

- Empty: the report control opens a focused panel that explains no evaluation has run
  and points to the owner-operated offline workflow without presenting a run action.
- Passing: a complete 100-point/no-hard-failure report shows report time, corpus size,
  provider score, pass count, p95 latency, estimated cost, usage coverage, and an
  explicit non-authoritative boundary.
- Degraded: failed, hard-failure, and inconclusive totals are visually distinct; each
  non-pass case exposes its safe case ID, outcome, score, and safe failure code.
- Multiple reports: newest report opens by default and a labeled selector loads a
  different validated detail without losing the conversation transcript.
- Unavailable: transport failure, non-success response, and valid API unavailable
  errors produce one retryable state saying no model call was started.
- Malformed/adversarial: unexpected fields, invalid metrics, unsafe IDs, markup-shaped
  text, inconsistent counts, and invalid detail contracts are rejected and rendered
  as unavailable inert text; no attacker-provided element or URL is created.
- Accessibility: report open, close, retry, report selector, status regions, provider
  headings, and case evidence are keyboard-addressable and named.

Required invariants:

- The content UI requests reports only through a fixed GET-only service-worker bridge.
  It cannot call the owner command or construct a provider-execution request.
- Both list and detail payloads are strict runtime-validated before rendering; all IDs
  and values enter the DOM through text properties, never HTML interpolation.
- Conversation messages, composer content, collapse behavior, preferences, existing
  evidence paths, and GTM workflows remain intact when the panel opens and closes.
- The panel distinguishes offline evaluation evidence from production behavior and
  states that models cannot confirm specifications, change GTM, or prove platform
  receipt.
- No credential, provider call, report write, GTM mutation, or publication behavior is
  added.

## Work

- Define strict frontend decoders and provider/case display states.
- Add a GET-only service-worker bridge for list and detail report routes.
- Add the accessible overlay panel, report selector, aggregate cards, non-pass case
  evidence, empty/error/retry states, and responsive styles.
- Add deterministic route fixtures, built-extension journeys, visual baselines, and an
  exploratory review covering happy, negative, and adversarial states.

## Done when

- Decoder, empty, passing, degraded, unavailable, adversarial, accessibility, and
  conversation-preservation regressions pass.
- New visual baselines have been inspected and the exploratory review has no unresolved
  blocker or high-severity findings.
- `npm run verify` and the exact-base change-documentation check pass.

## Comments

- 2026-08-23: Claimed after PR 42 merged the protected read-only report API. This is
  the first user-visible model-evaluation surface; it remains evidence-only and cannot
  start a paid run.
- 2026-08-23: Added the GET-only service-worker bridge, strict list/detail decoders,
  accessible overlay panel, report selector, aggregate provider cards, safe non-pass
  evidence, authority boundary, and empty/unavailable retry states. Ten decoder tests,
  strict extension TypeScript checking, the production build, and three frontend
  Chromium journeys pass.
- 2026-08-23: Visual review found faint composer bleed and a scrollable report header;
  both medium findings were fixed with a fully opaque bounded panel and sticky header.
  Empty, degraded, and unavailable baselines were regenerated and inspected. No
  unresolved blocker or high-severity finding remains.
- 2026-08-23: The first full gate reached all 273 deterministic tests and all 30
  behavioral Chromium journeys; six prior expanded-assistant snapshots failed only on
  the intentional 63–66 pixel `Evals` control. Their diffs were inspected and the six
  baselines were regenerated. The collapsed assistant baseline remained unchanged.
- 2026-08-23: The clean `npm run verify` rerun passed local preflight, change
  documentation, every workspace build and strict check, all 274 deterministic tests
  across 38 files, and all 30 Chromium workflows. No provider command, credential,
  external request, or paid call ran.
