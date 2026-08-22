# Complete conversational form E2E workflow

Status: claimed

Blocked by: 02, 03, 05, 07

## Objective

Exercise the supported user outcome from a plain-language request through confirmation, generation, guided verification, and evidence presentation.

## Regression contract

Required test level: Reusable browser-journey harness backed by a schema-validated acceptance fixture, plus deterministic explanation evaluation.

Acceptance fixture: `tests/acceptance/conversational-form-e2e.json`

Behavioral test target: `tests/e2e/conversational-form.spec.ts`

Journey helper: `tests/e2e/helpers/extension-journey.ts`

Explanation evaluator: `packages/core/src/explanation-eval.test.ts`

Required invariants:

- A successful, practitioner-confirmed form outcome reaches `browser_verified` while platform confirmation remains `unverified`.
- A submit attempt rejected by client validation never reaches `browser_verified` and produces `expected_non_conversion`.
- Both journeys begin with plain language, require specification confirmation, and use the same acceptance fixture committed before implementation.
- Every journey validates visible page effects, generated artifact semantics, evidence, verdict, next-action concepts, and forbidden platform claims.
- Explanation evaluation scores required meaning rather than exact prose so deterministic templates and later LLM output share one contract.

## Work

- Drive the floating assistant with a form-tracking intent.
- Resolve an ambiguous target or success signal through conversation.
- Review and confirm the structured specification.
- Validate the downloaded GTM container file.
- Execute a successful form journey and display its evidence path.
- Add a negative E2E case that must not pass.
- Load the committed acceptance fixture rather than duplicating its journeys inside the test.

## Done when

- The complete workflow requires no human browser operation or external credentials.
- Passing and non-passing outcomes are both asserted from visible evidence.
- Navigation regression coverage remains green.
- `tests/e2e/conversational-form.spec.ts` consumes every journey in the acceptance fixture with no skips.
- `npm run verify` passes.

## Comments
