# Apply the tracking change plan idempotently

Status: open

Blocked by: 02, 03

## Objective

Apply only approved create or product-owned update actions to the one managed workspace,
re-reading state before each boundary and converging repeated application to a no-op.

## Regression contract

Cover successful create/reuse, repeated application, interruption and resume, ownership
conflict, stale plan, synchronization conflict, partial Google failure, and disabled
writes using deterministic fake Google responses.
