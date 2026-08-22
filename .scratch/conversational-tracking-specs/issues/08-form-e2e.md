# Complete conversational form E2E workflow

Status: open

Blocked by: 02, 03, 05, 07

## Objective

Exercise the supported user outcome from a plain-language request through confirmation, generation, guided verification, and evidence presentation.

## Regression contract

Required test level: Browser E2E backed by a schema-validated acceptance fixture.

Acceptance fixture: `tests/acceptance/conversational-form-e2e.json`

Behavioral test target: `tests/e2e/conversational-form.spec.ts`

Required invariants:

- A successful, practitioner-confirmed form outcome reaches `browser_verified` while platform confirmation remains `unverified`.
- A submit attempt rejected by client validation never reaches `browser_verified` and produces `expected_non_conversion`.
- Both journeys begin with plain language, require specification confirmation, and use the same acceptance fixture committed before implementation.

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
