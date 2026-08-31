# Specify disposable container dry run

Status: proposed

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

- [ ] Procedure uses only disposable GTM resources.
- [ ] Procedure records operation ID, immutable version fingerprint, and prior live
      fingerprint.
- [ ] Procedure stops before exact publication approval.
