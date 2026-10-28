# Add semantic navigation scopes and local interpretation

Change record version: 2

Status: superseded by `.changes/2026-08-23-trim-semantic-navigation.md`

Original issues and supporting feature documents were removed with the subsystem.

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

This record preserves the original verification history. The active product boundary
and retained navigation review are recorded in
[`2026-08-23-trim-semantic-navigation.md`](./2026-08-23-trim-semantic-navigation.md).

## Documentation

The original glossary terms, ADR, local-model guide, feature review, specification, and
issues were removed when this change was superseded.
