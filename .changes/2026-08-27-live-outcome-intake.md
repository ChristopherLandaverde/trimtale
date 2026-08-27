# Ground outcome language with live model intake

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/40-live-goal-intake.md`

## Summary

Added a disabled-by-default live language-intake path that turns ordinary outcome
language into grounded, non-authoritative measurement candidates and admits exactly
one safe candidate into the existing deterministic workflow.

## Why

Practitioners should be able to say `Track lead generation` without translating their
outcome into a form, event name, or tagging instruction. The interpretation contract
must also support later outcomes without embedding lead generation into the product
model.

## Behavior

The extension constructs schema-v2 model input from a redacted message, aliased page
candidates, and aliased success evidence. It sends no selector, DOM ID, page URL, form
value, link value, credential, or raw page payload. One explicitly configured backend
Responses call may propose up to twelve conversion-outcome and observed-interaction
pairings. Only one valid, grounded, unambiguous, already-supported pairing re-enters
deterministic conversation intake.

Multiple, ambiguous, unknown, invented, private, malformed, or authoritative output
cannot expose setup review or approval. Provider absence, authentication failure, and
transport failure retain deterministic intake. Setup compilation, GTM and GA4 writes,
approval, publication, evidence, and verdicts are unchanged.

## Regression coverage

- `packages/core/src/intake-interpretation-v2.test.ts` protects privacy filtering,
  alias grounding, generic multi-candidate structure, safe adoption, and focus paths.
- `apps/api/src/live-intake-api.test.ts` protects organization authority and input/output
  validation around the provider.
- `apps/api/src/openai-intake-provider.test.ts` protects explicit configuration and the
  strict non-stored Responses request.
- `tests/e2e/goal-intake.spec.ts` protects the visible lead-outcome journey, invented
  grounding rejection, and multi-measurement focus boundary.
- The existing automatic-coverage task capture permits only ten anti-aliased border
  pixels of variance; content or geometry changes still fail its visual baseline.

## Verification

- Focused core, conversation, API, provider, and agent-turn suites: 56 tests passed.
- Focused Chromium goal-intake journeys: 3 passed.
- Final deterministic verification: 479 tests passed.
- Final Chromium verification: 90 journeys passed.

## Exploratory review

Reviewed the rendered happy, multiple-result, and prompt-shaped-page-evidence journeys
at full resolution. The supported interpretation reached exact setup review; multiple
results exposed no review or approval; and attacker-shaped page text remained inert.
See `docs/reviews/2026-08-27-live-outcome-intake.md`.

## Documentation

Updated the intake specification, canonical intake-interpretation definition,
engineering contract, current capabilities, and implementation issue. ADR 0001 already
records the governing model/tool authority decision, so no new ADR was required.
