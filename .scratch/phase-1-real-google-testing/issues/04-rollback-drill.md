# Specify rollback drill

Status: proposed

## Problem

A real disposable testing lane needs proof that a failed publication can restore the
recorded prior live version only after exact rollback approval.

## Regression Contract

- Define a controlled failed browser-verification setup.
- Require exact approval of the recorded prior live fingerprint.
- Record operation transition to `rolled_back`.

## Acceptance Criteria

- [ ] Failed evidence moves the operation to `rollback_required`.
- [ ] Rollback action names the prior live fingerprint.
- [ ] Approved rollback restores that fingerprint and records `rolled_back`.
- [ ] No autonomous rollback is allowed.
