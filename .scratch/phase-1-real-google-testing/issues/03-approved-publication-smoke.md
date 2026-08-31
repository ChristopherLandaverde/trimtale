# Specify approved publication smoke

Status: proposed

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

- [ ] Publication cannot proceed without exact fingerprint approval.
- [ ] Browser verification observes exactly one expected Google collection request.
- [ ] The resulting operation reaches `completed`.
- [ ] The assistant and notes say platform confirmation is unavailable, not confirmed.
