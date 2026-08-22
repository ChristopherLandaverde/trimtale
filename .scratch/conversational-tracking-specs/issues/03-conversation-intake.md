# Build constrained conversation intake

Status: open

Blocked by: 01

## Objective

Turn plain-language tracking intents into reviewable draft specifications without treating the model or chat transcript as the source of truth.

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
- `npm run verify` passes.

## Comments
