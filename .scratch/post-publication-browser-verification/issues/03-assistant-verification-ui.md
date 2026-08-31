# Add assistant post-publication verification UI

Status: resolved

Blocked by: 01, 02

## Objective

Let the assistant start a browser verification run only from a published operation and
display the resulting Google request verification state.

## Regression contract

Add extension E2E coverage for:

- `Start browser verification` appears only after publication.
- Successful navigation request evidence renders `Google request verified`.
- Successful lead-form request evidence renders `Google request verified`.
- Failed evidence renders rollback-required guidance and prior live fingerprint.
- The assistant displays platform confirmation as unavailable and never renders
  `platform-confirmed`.

## Notes

Use the existing verification capture mechanisms where possible. The assistant should
not rerun publication or assume platform processing from network evidence.

## Resolution Notes

- The assistant now renders post-publication browser verification controls only from
  published operation state and posts browser evidence through the workflow API.
- `tests/e2e/navigation-extension.spec.ts` covers successful navigation verification,
  successful lead-form verification, rollback-required failed verification,
  publication failure boundaries, durable reload behavior, and absence of
  `platform-confirmed` claims.
- `apps/extension/src/evidence-capture.test.ts` covers the navigation and form
  evidence controllers used by the assistant workflow.
- Exploratory review evidence is recorded in
  `docs/reviews/2026-08-30-post-publication-browser-verification.md`.
