# Add constrained conversation intake

Issue: `.scratch/conversational-tracking-specs/issues/03-conversation-intake.md`

## Summary

Adds deterministic conversation intake with an executable acceptance contract covering supported, ambiguous, corrected, unsupported, and unknown tracking intents.

## Why

Practitioners need to describe outcomes in ordinary language while structured state—not chat prose—controls what may be confirmed and generated.

## Behavior

Navigation behavior remains supported. The assistant recognizes form intent, discovers structured form metadata, requests target and success-evidence clarification, produces a reviewable `generate_lead` draft, and requires explicit confirmation. Unsupported types cannot enter setup flows. No form values or full page HTML are collected.

## Regression coverage

The committed acceptance fixture is validated immediately and consumed by deterministic conversation tests and the browser E2E. Screenshot-only styling also suppresses the six-pixel blinking caret while the behavioral test continues to assert actual composer focus.

## Verification

`npm run verify` passes in the combined workspace: strict TypeScript checks, 39 tests total, all builds, four strict visual comparisons, and two Chromium E2E journeys. The conversation branch itself adds ten deterministic/contract tests and one E2E journey to the 22-test merged baseline.

## Documentation

Issue 03 now records its regression contract, test files, ambiguity rules, confirmation boundary, and acceptance fixture.
