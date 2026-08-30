# Persist a resumable tracking-setup operation

Status: resolved

Blocked by: 02

## Objective

Persist the tracking specification, evidence, generated setup, container/workspace
fingerprints, tracking change plan, completed actions, validation, version, approval,
publication, post-publication evidence, and rollback target so interruptions resume
from freshly verified state.

## Regression contract

`packages/core/src/tracking-operation.test.ts` covers schema validation and migration,
every interruption status and next step, required fresh state, stale workspace and live
fingerprints, conflicting plans, completed actions, stage evidence, and refusal to reuse
approval for another version. `apps/api/src/tracking-operations.test.ts` covers atomic
private persistence, clone isolation, reopen/round trip, legacy loading, corrupted and
unsupported records, duplicate creation, identity preservation, and cross-instance
optimistic concurrency.

## Comments

- 2026-08-22: Claimed after the read-only tracking change planner merged. Version 1
  will validate stage-dependent evidence, migrate the initial planned-only schema,
  expose deterministic next steps, reject stale workspace/live-version fingerprints,
  and persist atomically with optimistic update protection.
- 2026-08-22: The full `npm run agent -- verify` gate passed local preflight,
  change-documentation and strict TypeScript checks, all 161 deterministic tests,
  every workspace build, and all 25 Chromium workflows. The operation and repository
  regression contract contributes 27 tests and performs no Google mutations.

## Answer

Tracking setup progress now has a versioned, stage-validated durable record. Resumption
requires fresh workspace and live-version fingerprints, exact-version publication
approval, completed prior-stage evidence, and a non-stale repository revision. Defined
legacy planned records migrate forward; corruption and unknown shapes fail closed.
