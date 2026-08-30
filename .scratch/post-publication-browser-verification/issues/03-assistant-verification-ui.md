# Add assistant post-publication verification UI

Status: open

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
