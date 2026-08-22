# Build the deterministic form fixture matrix

Status: open

Blocked by: 01

## Objective

Create local fixture behaviors for successful, failed, ambiguous, duplicated, consent-limited, dynamically inserted, and multi-form scenarios.

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
