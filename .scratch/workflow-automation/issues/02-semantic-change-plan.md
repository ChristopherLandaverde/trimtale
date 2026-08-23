# Build the read-only tracking change plan

Status: open

Blocked by: 01

## Objective

Compare a generated tracking setup with freshly read container and managed-workspace
entities and produce deterministic create, reuse, no-op, or conflict actions without
mutating GTM.

## Regression contract

Cover empty, identical, semantically equivalent with different IDs, partial, conflicting,
navigation, and lead-form setups. Repeated planning over equivalent normalized inputs
must return the same plan and fingerprint.
