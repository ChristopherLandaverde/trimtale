# Persist resumable tracking setup operations

Change record version: 2

Issue: `.scratch/workflow-automation/issues/03-resumable-operation-record.md`

## Summary

Added a schema-validated tracking setup operation state machine and an atomic,
optimistically concurrent file-backed repository for interruption-safe resumption.

## Why

The automated workflow needs a durable source of truth so a stopped run can re-read
Google state, refuse stale approval, and continue from a deterministic boundary without
duplicating or skipping work.

## Behavior

Version 1 binds the confirmed specification, generated setup, recognized container,
managed workspace, semantic plan, completed actions, validation, immutable version,
exact approval, publication evidence, and rollback state. Next-step selection requires
fresh workspace and live-version fingerprints; absent or changed state stops for refresh
or reconciliation. A narrow planned-only version-0 record migrates forward.

The API repository writes atomically with private file permissions, returns clones,
reloads state before updates, and rejects duplicate creation, stale revisions, identity
changes, corruption, invalid records, and unsupported schemas. This slice does not
perform GTM writes, validation, version creation, publication, or rollback.

## Regression coverage

`packages/core/src/tracking-operation.test.ts` covers every persisted status and next
step, required fresh state, conflict refusal, action completion, stale workspace/live
fingerprints, exact-version approval, and schema migration. `apps/api/src/tracking-operations.test.ts`
covers atomic private persistence, clone isolation, reopen/round trip, legacy loading,
corruption and schema rejection, duplicate IDs, identity preservation, and cross-instance
optimistic concurrency.

## Verification

Focused operation and repository tests pass. Full `npm run agent -- verify` evidence
will be recorded before completion.

## Exploratory review

Not applicable. This is an internal state-machine and persistence boundary with no new
built-product control or visible browser workflow.

## Documentation

Added the resumable-operation engineering contract and the canonical `Tracking setup
operation` glossary term; advanced the accepted workflow-automation specification and
issue after verification.
