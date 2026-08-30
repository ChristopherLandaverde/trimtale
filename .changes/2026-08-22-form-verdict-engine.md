# Add deterministic form verdicts

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/07-verdict-engine.md`

## Summary

Added an explicit evidence-to-verdict engine for all initial form diagnostics, with fixed precedence and one structured next action per result.

## Why

An LLM should explain observed tracking behavior, not guess whether a conversion passed. Deterministic rules make every diagnosis reproducible, testable, and suitable for concise conversational explanation.

## Behavior

The engine distinguishes expected non-conversions, browser verification, missing events, tags not firing, fired tags with missing requests, missing parameters, duplicates, consent limitations, submission failures, and insufficient evidence. Submission result and outcome observability are explicit inputs. Browser results never claim platform confirmation.

## Regression coverage

`packages/core/src/form-verdict.test.ts` covers every verdict branch, precedence, next action, non-passing safeguards, and all sixteen named fixture expectations. Fixture browser tests now assert all three required request parameters for correct cases.

## Verification

`npm run verify` passed with valid change documentation, strict type checks, 86 deterministic tests, all workspace builds, and 20 Chromium workflows.

## Exploratory review

No separate exploratory Chromium review is applicable because this slice adds deterministic classification with no new visible product surface. The raw form environments remain covered by the twenty-workflow Chromium suite.

## Documentation

Updated issue 07 and the accepted specification acceptance status.
