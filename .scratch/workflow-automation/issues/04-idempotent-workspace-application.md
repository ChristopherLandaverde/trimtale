# Apply the tracking change plan idempotently

Status: resolved

Blocked by: 02, 03

## Objective

Apply only approved create or product-owned update actions to the one managed workspace,
re-reading state before each boundary and converging repeated application to a no-op.

## Regression contract

`packages/core/src/change-plan.test.ts` covers product-owned update planning and
unowned name-collision refusal. `apps/api/src/google-application.test.ts` covers
successful create/reuse, repeated application, trigger-ID remapping, managed updates,
interruption and resume, ownership conflict, stale plan and workspace, synchronization
conflict, partial Google failure, and disabled writes using deterministic fake Google
responses.

## Comments

- 2026-08-22: Claimed after the resumable operation record merged. Application will
  accept only a schema-valid planned/applying operation for the exact recognized
  managed workspace, synchronize first, re-plan before each entity boundary, mark
  already-converged create/update actions complete, and restrict updates to entities
  carrying the product ownership marker.
- 2026-08-22: The full `npm run agent -- verify` gate passed local preflight,
  change-documentation and strict TypeScript checks, all 167 deterministic tests,
  every workspace build, and all 25 Chromium workflows. The Google application tests
  use only deterministic fake responses and perform no real Google writes.

## Answer

Ready plans now apply only to their exact recognized managed workspace. Each entity
boundary re-plans fresh state; completed or externally accepted creates converge to
reuse, managed updates use the entity fingerprint, unowned collisions fail closed, and
partial results return the exact signatures needed for safe resumption.
