# Add deterministic form verdicts

Status: resolved

Blocked by: 04, 06

## Objective

Classify normalized form evidence with explicit, explainable rules.

## Regression contract

Required test level: deterministic verdict-corpus tests under `npm test`.

Behavioral test: `packages/core/src/form-verdict.test.ts`

Required invariants:

- Every initial verdict code has at least one evidence case with a fixed next action.
- Validation errors, server errors, attempt-only outcomes, and unobservable outcomes remain distinct.
- Outcome, data-layer, tag-firing, request, parameter, duplication, and consent checks follow a documented precedence.
- No attempt-only or failed submission can return `browser_verified`.
- Platform confirmation always remains `unverified`.

## Work

- Implement the initial verdict vocabulary from the specification.
- Attach supporting observations and the shortest useful next action.
- Keep browser verification and platform confirmation separate.
- Add one or more corpus assertions for every verdict branch.

## Done when

- All sixteen initial scenarios return their expected verdicts.
- No attempt-only or failed submission scenario passes.
- Duplicate, missing-parameter, consent, and insufficient-evidence cases remain distinct.
- `npm run verify` passes.

## Comments

- 2026-08-22: Added fixed-precedence classification for all ten verdicts, explicit submission-result and outcome-observability evidence, tri-state tag firing, and one structured next action per result. Named corpus assertions cover all sixteen fixtures and prohibit passing validation, server-failure, attempt-only, and unobservable cases.

## Answer

Normalized form evidence now produces an explainable deterministic verdict before any LLM sees it. The LLM can use the verdict and next action for conversation, while the rule engine remains the source of truth and platform confirmation always remains unverified.
