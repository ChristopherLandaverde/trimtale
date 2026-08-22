# Complete conversational form E2E workflow

Status: open

Blocked by: 02, 03, 05, 07

## Objective

Exercise the supported user outcome from a plain-language request through confirmation, generation, guided verification, and evidence presentation.

## Work

- Drive the floating assistant with a form-tracking intent.
- Resolve an ambiguous target or success signal through conversation.
- Review and confirm the structured specification.
- Validate the downloaded GTM container file.
- Execute a successful form journey and display its evidence path.
- Add a negative E2E case that must not pass.

## Done when

- The complete workflow requires no human browser operation or external credentials.
- Passing and non-passing outcomes are both asserted from visible evidence.
- Navigation regression coverage remains green.
- `npm run verify` passes.

## Comments
