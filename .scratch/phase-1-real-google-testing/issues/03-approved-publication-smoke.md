# Specify approved publication smoke

Status: resolved

## Problem

The completed local flow needs one real disposable publication smoke that proves exact
fingerprint approval, publication, browser verification, and continued platform
confirmation honesty.

## Regression Contract

- Define an explicit approval step for the immutable version fingerprint.
- Require `GOOGLE_GTM_PUBLICATION_ENABLED=true` only for the approved disposable
  session.
- Record browser verification evidence and privacy sentinels.

## Acceptance Criteria

- [x] Publication cannot proceed without exact fingerprint approval.
- [x] Browser verification observes exactly one expected Google collection request.
- [x] The resulting operation reaches `completed`.
- [x] The assistant and notes say platform confirmation is unavailable, not confirmed.

## Resolution Notes

- Documented the approved disposable publication smoke in
  `docs/engineering/real-google-testing.md`.
- Executed the approved publication smoke on 2026-08-31 after exact owner approval
  for immutable version fingerprint `1788183353134`.
- Operation `operation_spec_disposable_form_smoke_2026_08_31_dry_run` published the
  approved fingerprint at `2026-08-31T13:52:25.577Z`, then browser verification run
  `run_spec_disposable_form_smoke_2026_08_31_dry_run_1788184399167` observed exactly
  one sanitized `generate_lead` request and completed with platform confirmation
  `unverified`.
- Evidence is recorded in `docs/reviews/2026-08-31-real-google-dry-run.md`.
