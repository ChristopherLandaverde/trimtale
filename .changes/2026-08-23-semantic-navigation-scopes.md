# Add semantic navigation scopes and local interpretation

Change record version: 2

Issue: `.scratch/semantic-navigation-scopes/issues/01-observed-target-groups.md`

## Summary

Navigation intake now groups observed targets by landmark and page region, uses a
bounded local Ollama adapter only for fuzzy group references, and compiles a confirmed
scope into region-aware reusable GTM entities.

## Why

Flat per-link selection cannot distinguish repeated header/footer destinations and
does not scale cleanly to containers with hundreds of existing entities. The new
boundary improves practitioner intent accuracy without giving the model selectors,
container state, evidence authority, or GTM mutation authority.

## Behavior

Explicit scope wording resolves deterministically. Fuzzy wording may produce a local
model suggestion containing only supplied group IDs; invalid or unavailable output
falls back to group-level clarification. Every scope remains practitioner-confirmed.
Generated navigation triggers now require both confirmed URL and CSS-selector matches,
include `navigation_area`, and reuse one area variable. Form setup, verdicts,
publication approval, and rollback authority are unchanged.

## Regression coverage

Core tests cover grouping, scope validation, contradictory model output, repeated URLs,
provider-neutral message redaction, region-aware generation, and a normalized 200-tag inventory. API tests cover the fixed
loopback Ollama adapter, schema validation, disabled and unavailable behavior, response
limits, and exact-origin CORS. Chromium coverage exercises grouped selection,
header/footer duplicate destinations, inert hostile labels, generated artifact
semantics, missing context, and managed-workspace preparation.

## Verification

`npm run verify` passes after the final exploratory remediation: 42 test files with
294 unit/API tests and all 36 Chromium journeys. Repeated synthetic live `qwen3:30b`
calls and a built-extension local-model exploratory path also pass.

## Exploratory review

[The semantic navigation scope review](../docs/reviews/2026-08-23-semantic-navigation-scopes.md)
covers fuzzy local inference, generic ambiguity, duplicate destinations, and an
instruction-shaped landmark label. Two medium findings were fixed during review; no
unresolved findings remain.

## Documentation

Updated `CONTEXT.md`, ADR 0002, the local-model development guide, current
capabilities, active roadmap, and the three semantic-navigation workflow issues.
