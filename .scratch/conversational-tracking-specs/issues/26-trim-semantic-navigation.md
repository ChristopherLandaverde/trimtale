# Trim semantic navigation infrastructure

Delivery mode: implementation

Status: resolved

## Production outcome

Navigation tracking keeps its direct practitioner-selected setup and verification path
without the semantic-grouping, local-model, evaluation-corpus, or automatic-preview
subsystems.

## Non-goals

- Removing basic navigation tracking.
- Changing the `navigation_click` event contract.
- Changing lead-form planning, connected GA4 evidence, or the agent workbench.
- Adding another interpretation provider or replacement framework.

## Authorization

The product owner selected navigation-infrastructure trimming before further workflow
implementation on 2026-08-23.

## Regression contract

- `tests/e2e/navigation-extension.spec.ts` proves the workbench still discovers,
  selects, generates, downloads, and prepares a managed workspace for basic navigation
  tracking.
- `packages/core/src/generator.test.ts` proves the retained navigation specification
  still compiles to its existing GTM event, trigger, variable, and parameters.
- `packages/core/src/verification.test.ts` retains deterministic navigation evidence
  classification.
- The ordinary build and test gates prove no removed model or semantic-scope module is
  required by the retained product.

## Comments

- 2026-08-23: Claimed before implementation. The removal boundary preserves the
  pre-semantic navigation workflow from `b5974c3`.
- 2026-08-23: Removed the semantic runtime, local provider, evaluation corpus,
  automatic preview, ADR, and supporting documents. Full verification passed 273
  deterministic tests and 38 Chromium journeys; direct navigation selection remains.
