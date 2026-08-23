# Validate workspaces and create immutable versions

Change record version: 2

Issue: `.scratch/workflow-automation/issues/05-validation-and-version.md`

## Summary

Added fresh managed-workspace validation and immutable GTM version creation with exact
change, compiler, version-fingerprint, and prior-live rollback evidence.

## Why

Publication approval must refer to a clean immutable version, not mutable workspace
state or an unverified claim that the generated configuration compiles.

## Behavior

Validation requires the recorded workspace fingerprint, rejects merge conflicts and
unowned changes, confirms semantic convergence, and records status plus quick-preview
compiler evidence. Version creation reruns validation, captures the current live path
and fingerprint, and accepts only a clean new version path and fingerprint. The opt-in
OAuth lane adds the container-version edit scope required by Google.

No publication endpoint is called or newly supported.

## Regression coverage

`apps/api/src/google-validation-version.test.ts` covers valid evidence, compiler error,
stale workspace, unexpected change, successful immutable version and prior-live
evidence, create-version compiler rejection, HTTP failure, and absence of publication.
OAuth tests protect the explicit scope boundary. Existing operation tests retain
stage-dependent validation and exact version evidence.

## Verification

`npm run agent -- verify` passed local preflight, change-documentation and strict
TypeScript checks, all 173 deterministic tests, every workspace build, and all 25
Chromium workflows. The focused Google validation/version contract contains six tests.

## Exploratory review

Not applicable. This is an internal Google-client evidence boundary with no new
built-product control or visible browser workflow. All ordinary tests use deterministic
fakes and cannot contact Google.

## Documentation

Added the validation/version engineering contract and updated the managed-workspace
OAuth scope contract; the accepted workflow specification and issue advance after
verification.
