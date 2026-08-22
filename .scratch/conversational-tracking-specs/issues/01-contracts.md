# Define versioned tracking contracts

Status: resolved

## Objective

Add shared, runtime-validated contracts for `TrackingSpecificationV1`, `TrackingScenarioV1`, `TrackingRunEvidenceV1`, and deterministic verdict codes.

## Work

- Place canonical types and validators in the shared core package.
- Reject unknown schema versions and invalid interaction/event combinations.
- Validate selectors, URL patterns, parameter names, and evidence variants.
- Add serialization round-trip and malformed-input tests.

## Done when

- The extension, API, generator, evaluator, and tests import the same contracts.
- Invalid or unsupported contracts fail with actionable errors.
- `npm run verify` passes.

## Comments

- 2026-08-22: Added shared versioned contracts and runtime validators for tracking specifications, scenarios, and run evidence. Added round-trip, unknown-version, incompatible-combination, form-success-evidence, and envelope validation tests. `npm run verify` passed with 17 unit/scenario tests and the Chromium E2E test.

## Answer

The core package now exports one versioned contract vocabulary for tracking specifications, scenarios, run evidence, and verdict codes. Runtime assertions reject unsupported schema versions and invalid navigation/form combinations.
