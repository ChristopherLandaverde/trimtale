# Add deterministic form verdicts

Status: open

Blocked by: 04, 06

## Objective

Classify normalized form evidence with explicit, explainable rules.

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
