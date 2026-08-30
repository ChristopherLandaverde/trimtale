# Build constrained conversation intake

Status: resolved

Blocked by: 01

## Objective

Turn plain-language tracking intents into reviewable draft specifications without treating the model or chat transcript as the source of truth.

## Regression contract

Required test level: Deterministic conversation-state tests backed by a schema-validated acceptance fixture, plus browser E2E for the supported UI path.

Acceptance fixture: `tests/acceptance/conversation-intake.json`

Behavioral tests:

- `packages/core/src/conversation.test.ts`
- `tests/e2e/conversation-intake.spec.ts`

Required invariants:

- Navigation, form, phone, email, and unknown intents classify distinctly.
- Multiple form targets require target clarification.
- Multiple plausible success signals require success-evidence clarification.
- A draft form specification cannot become confirmed without explicit practitioner confirmation.
- Corrections replace the affected structured field without losing the original intent.
- Unsupported interaction types never map to navigation or form setup.
- Deterministic state and actions are asserted independently from exact explanatory prose.

## Work

- Implement the supported interaction classification vocabulary.
- Add structured discovery results for candidate forms and success signals.
- Implement the intake state machine and focused clarification questions.
- Present a specification summary with edit and confirm actions.
- Preserve the original intent and explicit practitioner confirmations.
- Return honest unsupported-capability and insufficient-evidence responses.

## Done when

- Navigation and form intents take distinct deterministic paths.
- Ambiguous targets and success evidence require clarification.
- Free-form messages cannot bypass specification validation or confirmation.
- Conversation tests cover supported, ambiguous, corrected, and unsupported intents.
- Both behavioral tests consume the committed acceptance fixture with no skips.
- `npm run verify` passes.

## Comments

- 2026-08-22: Added deterministic classification and state transitions, structured form discovery, target/success-evidence clarification, draft review, and explicit confirmation. The acceptance fixture is consumed by core and browser tests. The combined workspace `npm run verify` passed with 39 tests (32 belonging to the merged base plus this slice) and two Chromium E2E journeys.

## Answer

The existing assistant now translates supported plain-language navigation and form intents into deterministic structured state. Form intake discovers safe metadata, requires clarification when targets or success evidence are ambiguous, presents a `generate_lead` draft, and cannot confirm it without an explicit practitioner action. Phone, email, CTA, unknown, and insufficient-evidence paths remain separate and cannot enter setup generation.
