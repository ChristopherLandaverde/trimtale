# Apply managed-workspace plans idempotently

Change record version: 2

Issue: `.scratch/workflow-automation/issues/04-idempotent-workspace-application.md`

## Summary

Added ownership-constrained, interruption-safe application of ready tracking change
plans to the exact recognized managed workspace.

## Why

Automated setup must be safe to retry after Google or process interruption without
duplicating entities, overwriting practitioner-owned work, or applying a stale plan.

## Behavior

Application requires opt-in GTM writes, validates the operation and plan fingerprint,
re-recognizes the container, checks the exact workspace fingerprint, synchronizes, and
re-plans before every entity boundary. Creates carry an ownership note, generated
trigger IDs are remapped to Google IDs, semantic reuse/no-ops avoid writes, and partial
creates reconcile on retry. Updates require the exact ownership marker and current
entity fingerprint; unowned collisions and stale or conflicting state fail closed.

Validation, version creation, publication approval, publication, and rollback remain
out of scope.

## Regression coverage

`packages/core/src/change-plan.test.ts` protects managed-only update planning while
retaining unowned name-collision refusal. `apps/api/src/google-application.test.ts`
covers successful create/reuse, repeat convergence, trigger remapping, managed update
fingerprints, interruption and resume, ownership conflict, stale plan and workspace,
synchronization conflict, partial Google failure, and disabled writes with deterministic
fake Google responses.

## Verification

`npm run agent -- verify` passed local preflight, change-documentation and strict
TypeScript checks, all 167 deterministic tests, every workspace build, and all 25
Chromium workflows. The focused application contract contains five end-to-end fake
Google tests plus the managed-update planner regression.

## Exploratory review

Not applicable. This is an internal Google-client execution boundary with no new
built-product control or visible browser workflow. Deterministic fakes prevent ordinary
verification from contacting or mutating Google.

## Documentation

Added the idempotent application engineering contract and the canonical `Managed GTM
entity` glossary term; the accepted workflow specification and issue advance after
verification.
