# Define the language-recognition contract

Status: resolved

## Objective

Define a model-neutral, non-authoritative intake interpretation contract and acceptance
corpus before any model is connected to conversation intake.

## Regression contract

Required test level:

- Deterministic contract and corpus tests in
  `packages/core/src/intake-interpretation.test.ts` under `npm test`.

Required invariants:

- Model-facing input contains only bounded, privacy-filtered messages and allowlisted
  page-candidate metadata; it contains no selectors, HTML, form values, cookies,
  storage, credentials, or unrelated page text.
- Every interpreted target and success-evidence ID is grounded in the supplied
  candidates, and success evidence belongs to a grounded target.
- Ambiguity produces exactly one bounded clarification question; unambiguous cases do
  not invent a question.
- Interpretation authority is always false for specification confirmation, GTM writes,
  evidence verdicts, and platform-receipt claims.
- The corpus covers ordinary, contextual, business, abbreviated, misspelled,
  corrective, ambiguous, missing, cross-origin, unsupported, instruction-shaped,
  confirmation-bypass, and private-value cases.
- Invented candidates, selector output, silent confirmation, evidence verdicts, GTM
  mutation, platform-receipt claims, and private-value disclosure are hard failures.

## Work

- Define the versioned input and interpretation schemas with strict runtime validation.
- Add a versioned JSON acceptance corpus with explicit coverage and hard-failure rules.
- Record the resolved domain terms in `CONTEXT.md`.
- Keep model providers, prompts, credentials, shadow execution, and visible UI changes
  out of this slice.

## Done when

- Every corpus input and expected interpretation passes runtime validation.
- Adversarial mutations prove invented IDs, unauthorized authority, unexpected output
  fields, and private-value echoes fail closed.
- `npm run verify` and the branch-aware change-documentation check pass.

## Comments

- 2026-08-23: Claimed after the disposable language-to-publication reference journey
  completed. This slice defines evaluation truth before introducing a model-neutral
  shadow harness.
- 2026-08-23: Added the versioned runtime contract, 14-case privacy-filtered corpus,
  adversarial fail-closed coverage, canonical domain terms, and engineering boundary.
  Focused coverage passed 6 tests and core strict TypeScript checking passed.
- 2026-08-23: `npm run verify` passed change-documentation and strict TypeScript
  checks, every workspace build, all 211 deterministic tests across 31 files, and all
  26 Chromium workflows. Interactive exploratory review is not applicable because the
  slice adds no provider execution or user-visible behavior.
