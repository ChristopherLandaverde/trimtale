# Validate the workspace and create an immutable version

Status: open

Blocked by: 04

## Objective

Run GTM workspace validation, present exact changes and compiler errors, and create a
version only from a clean validated managed workspace while preserving the prior live
version as the rollback target.

## Regression contract

Cover valid, compiler-error, stale-workspace, unexpected-change, version-creation
failure, and exact version-fingerprint evidence without publishing.
