# Specify rollback drill

Status: resolved

## Problem

A real disposable testing lane needs proof that a failed publication can restore the
recorded prior live version only after exact rollback approval.

## Regression Contract

- Define a controlled failed browser-verification setup.
- Require exact approval of the recorded prior live fingerprint.
- Record operation transition to `rolled_back`.

## Acceptance Criteria

- [x] Failed evidence moves the operation to `rollback_required`.
- [x] Rollback action names the prior live fingerprint.
- [x] Approved rollback restores that fingerprint and records `rolled_back`.
- [x] No autonomous rollback is allowed.

## Resolution Notes

- Documented the rollback drill in `docs/engineering/real-google-testing.md`.
- Executed the rollback drill on 2026-08-31 with operation
  `operation_spec_disposable_form_smoke_2026_08_31_rollback_drill`.
- Published disposable version fingerprint `1788185422573`, recorded controlled
  failed browser evidence
  `run_spec_disposable_form_smoke_2026_08_31_rollback_drill_blocked_collect_1788185485815`,
  and moved the operation to `rollback_required`.
- Approved rollback only for prior-live fingerprint `1788183353134`; rollback
  completed at `2026-08-31T14:11:59.540Z` and live container readback confirmed
  version `7`, fingerprint `1788183353134`.
- Evidence is recorded in `docs/reviews/2026-08-31-real-google-dry-run.md`.
