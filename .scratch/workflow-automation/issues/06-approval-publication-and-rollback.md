# Bind publication and rollback to verified versions

Status: claimed

Blocked by: 05

## Objective

Require publication approval for one exact version fingerprint, publish only while it
remains current, collect post-publication evidence, and retain a verified rollback path
to the prior live version.

## Regression contract

Cover approved publication, missing/expired/wrong-fingerprint approval, live-version
drift, publication failure, passing and failing post-publication checks, and explicit
rollback evidence. Ordinary CI must never call the real publication endpoint.

## Comments

- 2026-08-22: Claimed after validation/version creation merged. Publication will use
  a separate backend enablement flag and OAuth publish scope, a short-lived practitioner
  approval for one exact immutable version, fresh prior-live and version reads, and the
  GTM fingerprint guard. Failed post-publication evidence will require explicit rollback
  to the recorded prior-live fingerprint rather than silently completing.
