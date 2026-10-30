# Specify disposable container dry run

Status: resolved

## Problem

Before publication, the team needs a credentialed disposable-container run that
exercises real recognition, managed workspace preparation, idempotent application,
validation, and version creation.

## Regression Contract

- Define a dry-run procedure that stops at `versioned`.
- Preserve the invariant that nothing is published in this lane.
- Record expected evidence and recovery steps for workspace capacity, ownership,
  sync conflict, stale workspace, and stale plan failures.

## Acceptance Criteria

- [x] Procedure uses only disposable GTM resources.
- [x] Procedure records operation ID, immutable version fingerprint, and prior live
      fingerprint.
- [x] Procedure stops before exact publication approval.

## Resolution Notes

- Documented the disposable dry-run procedure in
  `docs/engineering/real-google-testing.md`.
- Executed the disposable dry-run on 2026-08-31 and recorded evidence in
  `docs/reviews/2026-08-31-real-google-dry-run.md`.
- Operation `operation_spec_disposable_form_smoke_2026_08_31_dry_run` reached
  `versioned` with immutable version fingerprint `1788183353134` and prior live
  fingerprint `1787798811643`; no publication was recorded.
