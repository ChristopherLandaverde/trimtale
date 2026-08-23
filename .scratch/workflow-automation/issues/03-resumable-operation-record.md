# Persist a resumable tracking-setup operation

Status: claimed

Blocked by: 02

## Objective

Persist the tracking specification, evidence, generated setup, container/workspace
fingerprints, tracking change plan, completed actions, validation, version, approval,
publication, post-publication evidence, and rollback target so interruptions resume
from freshly verified state.

## Regression contract

Cover round-trip validation, schema migration, corrupted records, stale fingerprints,
interruption before and after every mutation boundary, and refusal to reuse stale
publication approval.

## Comments

- 2026-08-22: Claimed after the read-only tracking change planner merged. Version 1
  will validate stage-dependent evidence, migrate the initial planned-only schema,
  expose deterministic next steps, reject stale workspace/live-version fingerprints,
  and persist atomically with optimistic update protection.
