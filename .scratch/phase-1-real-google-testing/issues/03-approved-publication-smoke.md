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
