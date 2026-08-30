# Build the deterministic form fixture matrix

Status: resolved

Blocked by: 01

## Objective

Create local fixture behaviors for successful, failed, ambiguous, duplicated, consent-limited, dynamically inserted, and multi-form scenarios.

## Regression contract

Required test level: deterministic fixture-matrix tests under `npm test`, followed by local Chromium replay assertions.

Behavioral test: `apps/fixture-site/src/form-scenarios.test.ts`

Required invariants:

- All sixteen accepted scenario IDs exist exactly once and can be selected independently.
- Attempt-only, validation-failure, server-error, and unobservable iframe cases emit no conversion signals.
- Data-layer, tag-fire, request, parameter, duplication, and consent states remain independently reproducible.
- Dynamic, multiple-form, and cross-origin presentations remain explicit rather than inferred.

## Work

- Extend the fixture site without external services.
- Represent all sixteen scenarios from the specification.
- Ensure fixtures never require real personal information.
- Make each environment state explicit and reproducible.

## Done when

- Every scenario can be selected and replayed independently.
- Expected page, data-layer, network, and consent signals are deterministic.
- Fixture tests prove the scenario itself before testing product verdicts.
- `npm run verify` passes.

## Comments

- 2026-08-22: Added a typed sixteen-scenario matrix and connected every scenario to the local fixture page. Four deterministic matrix tests and sixteen browser replays cover transports, presentations, outcomes, data-layer events, request counts, required parameters, and consent without external services or personal information.

## Answer

Every form scenario in the accepted specification is now an explicit, independently selectable local environment. The fixture can reproduce successful AJAX, redirect and SPA outcomes; failed and attempt-only submissions; missing pipeline stages; parameter and duplication defects; denied consent; dynamic and multiple forms; and an unobservable cross-origin iframe.
