# Bind publication and rollback to verified versions

Change record version: 2

Issue: `.scratch/workflow-automation/issues/06-approval-publication-and-rollback.md`

## Summary

Added short-lived exact-version publication approval, separately enabled and
fingerprint-guarded publication, post-publication evidence decisions, and verified
rollback to the recorded prior live version.

## Why

End-to-end automation must not turn broad write authorization or stale review into a
production publish, and a failed live verification needs a trustworthy recovery path.

## Behavior

Approval binds a practitioner and 30-minute lifetime to one immutable fingerprint.
Publication requires a separate backend flag and OAuth scope, fresh immutable and live
fingerprints, and Google's request fingerprint guard. Passing evidence completes the
operation; failing evidence requires rollback. Rollback rechecks both live and target
fingerprints before publishing the prior version and returning completion evidence.

Ordinary CI and verification never enable or contact the real publication endpoint.

## Regression coverage

`packages/core/src/publication.test.ts` covers exact approval, expiry, wrong
fingerprints, passing completion, and failing-evidence rollback decisions.
`apps/api/src/google-publication.test.ts` covers approved publication, missing backend
enablement, expired approval, live/version drift, publication failure, exact publish
paths, and explicit rollback evidence. OAuth and preflight tests protect the separate
publish scope and switch.

## Verification

`npm run agent -- verify` passed local preflight, change-documentation and strict
TypeScript checks, all 184 deterministic tests, every workspace build, and all 25
Chromium workflows. The focused publication contract contains nine core/Google tests
plus OAuth and publication-preflight guards.

## Exploratory review

Not applicable. This is an internal Google-client and evidence boundary with no new
built-product control or visible browser workflow. All ordinary publication tests use
deterministic fakes.

## Documentation

Added the approved-publication/rollback engineering contract and publication-session
preflight instructions; the accepted workflow specification and issue advance after
verification.
