# Define post-publication evidence contract

Status: resolved

## Objective

Define the versioned request/response contract that records browser evidence against
a published tracking setup operation without claiming platform confirmation.

## Regression contract

Add deterministic tests covering:

- A published operation accepts matching browser-verified evidence and becomes
  `completed`.
- A published operation accepts failed browser evidence and becomes
  `rollback_required`.
- Non-published operations reject post-publication evidence.
- Evidence for the wrong specification ID is rejected.
- Platform confirmation remains unavailable/unverified in persisted evidence and UI
  summaries.

## Notes

Reuse `TrackingRunEvidenceV1`, `recordPostPublicationEvidence`, and the existing
operation statuses where possible. Prefer a narrow route contract over introducing a
second proof model.

## Resolution Notes

- Implemented the post-publication evidence contract with existing
  `TrackingRunEvidenceV1`, `recordPostPublicationEvidence`, and durable operation
  statuses.
- `packages/core/src/publication.test.ts` covers passing browser evidence moving an
  operation to `completed` and failed browser evidence moving an operation to
  `rollback_required`.
- `apps/api/src/workflow-runner.test.ts` covers published-only recording,
  wrong-specification rejection, completed transitions, rollback-required transitions,
  and platform confirmation remaining `unverified`.
- Browser workflow coverage in `tests/e2e/navigation-extension.spec.ts` verifies
  visible assistant behavior for navigation and lead-form post-publication evidence.
