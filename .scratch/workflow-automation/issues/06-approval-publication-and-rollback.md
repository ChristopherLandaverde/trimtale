# Bind publication and rollback to verified versions

Status: resolved

Blocked by: 05

## Objective

Require publication approval for one exact version fingerprint, publish only while it
remains current, collect post-publication evidence, and retain a verified rollback path
to the prior live version.

## Regression contract

`packages/core/src/publication.test.ts` covers exact approval, missing eligibility,
expiry, wrong fingerprint, passing completion, and failing-evidence rollback decisions.
`apps/api/src/google-publication.test.ts` covers approved publication, separate backend
disablement, live/version drift, publication failure, exact fingerprint-guarded paths,
and explicit rollback evidence. OAuth and preflight tests protect the separate publish
scope and switch. Every ordinary test uses fake fetch and cannot call Google.

## Comments

- 2026-08-22: Claimed after validation/version creation merged. Publication will use
  a separate backend enablement flag and OAuth publish scope, a short-lived practitioner
  approval for one exact immutable version, fresh prior-live and version reads, and the
  GTM fingerprint guard. Failed post-publication evidence will require explicit rollback
  to the recorded prior-live fingerprint rather than silently completing.
- 2026-08-22: The full `npm run agent -- verify` gate passed local preflight,
  change-documentation and strict TypeScript checks, all 184 deterministic tests,
  every workspace build, and all 25 Chromium workflows. The publication switch was
  absent throughout; production Google was never contacted.

## Answer

Production publication now requires separate backend enablement and OAuth scope plus
an unexpired practitioner approval for the exact immutable fingerprint. Fresh version
and live reads and Google's fingerprint guard prevent stale publication. Passing live
evidence completes the operation; failure records an explicit, freshly verified
rollback to the prior-live fingerprint.
