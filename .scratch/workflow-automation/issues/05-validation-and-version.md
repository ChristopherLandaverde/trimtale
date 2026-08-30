# Validate the workspace and create an immutable version

Status: resolved

Blocked by: 04

## Objective

Run GTM workspace validation, present exact changes and compiler errors, and create a
version only from a clean validated managed workspace while preserving the prior live
version as the rollback target.

## Regression contract

`apps/api/src/google-validation-version.test.ts` covers valid change and preview
evidence, compiler error, stale workspace, unexpected change, semantic divergence,
version-creation compiler and request failure, exact new-version and prior-live
fingerprints, and the absence of publication calls. `apps/api/src/google.test.ts`
protects the explicit container-version OAuth scope.

## Comments

- 2026-08-22: Claimed after idempotent application merged. Validation will combine
  exact workspace changes with GTM quick-preview compiler evidence; version creation
  will revalidate fresh workspace state, retain the currently live version path and
  fingerprint first, and reject compiler, sync, fingerprint, or unexpected-change
  evidence without calling publication.
- 2026-08-22: The full `npm run agent -- verify` gate passed local preflight,
  change-documentation and strict TypeScript checks, all 173 deterministic tests,
  every workspace build, and all 25 Chromium workflows. Validation/version coverage
  uses fake Google responses and proves no publication endpoint is called.

## Answer

Applied workspaces now produce exact status, semantic-convergence, and quick-preview
compiler evidence. Only freshly revalidated state can create an immutable version, and
the result binds its path and fingerprint to the immediately prior live version as a
rollback target without publishing.
