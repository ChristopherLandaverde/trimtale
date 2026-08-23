# Add semantic navigation scopes and local interpretation

Change record version: 2

Issue: `.scratch/semantic-navigation-scopes/issues/01-observed-target-groups.md` and
`.scratch/semantic-navigation-scopes/issues/05-reversible-navigation-preview.md`

## Summary

Navigation intake now groups observed targets by landmark and page region, uses a
bounded local Ollama adapter only for fuzzy group references, and compiles a confirmed
scope into region-aware reusable GTM entities. One unambiguous match is previewed on
the page immediately and remains removable before or after keyboard confirmation.

## Why

Flat per-link selection cannot distinguish repeated header/footer destinations and
does not scale cleanly to containers with hundreds of existing entities. The new
boundary improves practitioner intent accuracy without giving the model selectors,
container state, evidence authority, or GTM mutation authority.

## Behavior

Explicit scope wording resolves deterministically. Fuzzy wording may produce a local
model suggestion containing only supplied group IDs; invalid or unavailable output
falls back to group-level clarification. Every scope remains practitioner-confirmed.
One valid candidate is highlighted as a reversible preview before confirmation;
`Enter` confirms it, while `Escape` or the visible Remove action clears the preview or
local draft without changing GTM. Zero or multiple candidates still require a bounded
group choice.
Generated navigation triggers now require both confirmed URL and CSS-selector matches,
include `navigation_area`, and reuse one area variable. Form setup, verdicts,
publication approval, and rollback authority are unchanged.

## Regression coverage

Core tests cover grouping, scope validation, contradictory model output, repeated URLs,
provider-neutral message redaction, the complete 32-case functional corpus,
region-aware generation, and a normalized 200-tag inventory. API tests cover the fixed
loopback Ollama adapter, schema validation, disabled and unavailable behavior, response
limits, routed smoke/full execution, timeout and failure reporting, and exact-origin
CORS. Chromium coverage exercises immediate single-group preview, real post-send
keyboard focus, Enter confirmation, Escape and visible removal, grouped selection,
header/footer duplicate destinations, inert hostile labels, generated artifact
semantics, missing context, and managed-workspace preparation. Reviewed visual
baselines now cover the page-wide preview and the persistent removal control; the
preview baseline also protects top-edge label placement.

## Verification

`npm run verify` passes after the final exploratory remediation: 307 unit/API tests
across 44 test files and all 37 Chromium journeys. The routed live
`qwen3:30b` smoke lane passes 15/15 cases and the full lane passes 32/32. A built-extension
local-model exploratory path also passes.

## Exploratory review

[The semantic navigation scope review](../docs/reviews/2026-08-23-semantic-navigation-scopes.md)
also covers immediate preview, keyboard confirmation and removal, fuzzy local inference,
generic ambiguity, duplicate destinations, an
instruction-shaped landmark label, and attacker-shaped practitioner wording. Four
medium findings were fixed during review; no
unresolved findings remain.

## Documentation

Updated `CONTEXT.md`, ADR 0002, the local-model development guide, current
capabilities, active roadmap, and the five semantic-navigation workflow issues.
