# Add the deterministic form fixture matrix

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/04-form-fixtures.md`

## Summary

Added sixteen selectable local form environments covering successful, failed, ambiguous, missing, duplicated, consent-limited, dynamic, multi-form, and cross-origin cases.

## Why

Form evidence and verdict work needs reproducible browser environments whose signals can be varied independently without external services or personal information.

## Behavior

Each `formScenario` selects an explicit immutable environment. The fixture exposes non-sensitive scenario state, simulates supported submission transports, emits configured data-layer and local GA4-request signals, and keeps unobservable or non-conversion cases signal-free. Unknown scenario IDs safely select the ordinary successful fixture.

## Regression coverage

`apps/fixture-site/src/form-scenarios.test.ts` validates matrix completeness and diagnostic invariants. `tests/e2e/form-fixtures.spec.ts` replays all sixteen cases in Chromium and asserts presentation, consent, outcome, data-layer, request count, and required-parameter behavior.

## Verification

`npm run verify` passed with valid change documentation, strict type checks, 46 deterministic tests, all workspace builds, and 20 Chromium workflows.

## Exploratory review

No separate exploratory review is applicable because this change is deterministic test-fixture infrastructure rather than a new practitioner-facing workflow. The complete fixture surface is replayed directly in Chromium, including negative and insufficient-evidence cases.

## Documentation

Issue 04 now contains its executable regression contract and concrete completion evidence.
