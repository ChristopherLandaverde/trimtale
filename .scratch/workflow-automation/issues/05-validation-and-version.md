# Validate the workspace and create an immutable version

Status: claimed

Blocked by: 04

## Objective

Run GTM workspace validation, present exact changes and compiler errors, and create a
version only from a clean validated managed workspace while preserving the prior live
version as the rollback target.

## Regression contract

Cover valid, compiler-error, stale-workspace, unexpected-change, version-creation
failure, and exact version-fingerprint evidence without publishing.

## Comments

- 2026-08-22: Claimed after idempotent application merged. Validation will combine
  exact workspace changes with GTM quick-preview compiler evidence; version creation
  will revalidate fresh workspace state, retain the currently live version path and
  fingerprint first, and reject compiler, sync, fingerprint, or unexpected-change
  evidence without calling publication.
