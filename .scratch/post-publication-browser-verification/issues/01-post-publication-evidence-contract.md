# Define post-publication evidence contract

Status: open

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
