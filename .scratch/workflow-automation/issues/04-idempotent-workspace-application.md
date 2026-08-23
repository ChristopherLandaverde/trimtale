# Apply the tracking change plan idempotently

Status: claimed

Blocked by: 02, 03

## Objective

Apply only approved create or product-owned update actions to the one managed workspace,
re-reading state before each boundary and converging repeated application to a no-op.

## Regression contract

Cover successful create/reuse, repeated application, interruption and resume, ownership
conflict, stale plan, synchronization conflict, partial Google failure, and disabled
writes using deterministic fake Google responses.

## Comments

- 2026-08-22: Claimed after the resumable operation record merged. Application will
  accept only a schema-valid planned/applying operation for the exact recognized
  managed workspace, synchronize first, re-plan before each entity boundary, mark
  already-converged create/update actions complete, and restrict updates to entities
  carrying the product ownership marker.
