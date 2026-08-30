# Approval-gated publish from assistant

Status: resolved

## Objective

Let the assistant publish a prepared GTM version only after the practitioner sees the
immutable version fingerprint and explicitly chooses the matching publish action.

## Regression contract

Add deterministic tests covering:

- Publishing succeeds only from a versioned operation with the exact immutable
  fingerprint.
- Fingerprint mismatch and repeated publication block before a second Google publish
  call.
- Assistant publish UI appears only on the versioned operation card.
- After publication, browser verification and platform confirmation remain pending
  and separate.

## Notes

Resolved in the approval-gated publish slice. Publication remains behind backend
publication enablement, OAuth publication scope, current approval lifetime, live
version drift checks, and exact fingerprint matching.
