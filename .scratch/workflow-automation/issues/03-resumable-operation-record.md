# Persist a resumable tracking-setup operation

Status: open

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
