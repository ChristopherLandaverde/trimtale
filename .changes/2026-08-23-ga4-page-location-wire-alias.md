# Accept GA4 standard page-location evidence

Change record version: 2

Issue: `.scratch/workflow-automation/issues/08-ga4-page-location-wire-alias.md`

## Summary

The form verifier now recognizes GA4's standard `dl` wire parameter as the semantic
`page_location` required by a `generate_lead` request.

## Why

The live disposable-container smoke produced a correct GA4 request, but the verifier
falsely required the custom `ep.page_location` spelling and classified the request as
missing a parameter.

## Behavior

One request passes when `form_id` and `form_name` are present and page location appears
as either `dl` or `ep.page_location`. Evidence normalization retains either spelling,
removes page-location queries, and continues discarding unknown parameters. Requests
with neither page-location spelling still fail. Platform confirmation remains
unverified, and no publication or rollback boundary changed.

## Regression coverage

`packages/core/src/form-verdict.test.ts` covers the live `dl` representation and the
negative no-location case. `packages/core/src/form-evidence.test.ts` covers retention
and privacy redaction of an attacker-shaped `dl` URL.

## Verification

`npm run verify` passed with valid change documentation, strict TypeScript checks, 197
deterministic tests across 29 files, all workspace builds, and 25 Chromium workflows.
The credentialed disposable-container smoke separately observed one exact matching
live request and is not part of ordinary CI.

## Exploratory review

`docs/reviews/2026-08-23-ga4-page-location-wire-alias.md` records the live disposable
Chromium signal, the negative invariant, the adversarial URL privacy check, and the
absence of a real smoke-form target.

## Documentation

The issue, change record, and exploratory report document the GA4 transport alias and
the distinction between signal-level verification and a complete form journey.
