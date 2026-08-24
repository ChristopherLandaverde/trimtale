# Persist the local Google workflow session

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/29-persistent-google-session.md`

## Summary

Added one local launcher for Google preflight and API sessions. It loads the existing
OAuth grant from owner-only files without placing credentials in Git or shell history.

## Why

Credentialed workflow sessions should reuse the existing grant without requiring
credentials in every shell or conversation.

## Behavior

- `npm run google -- preflight` validates the saved local configuration.
- `npm run google -- api` starts the API with the saved OAuth client, refresh token,
  extension origin, and guarded container-write access.
- Client/token mismatches and non-private files fail closed without exposing values.
- Publication remains forced off. Re-consent and live GTM mutation remain out of scope.

## Regression coverage

`scripts/google-session.test.ts` covers valid loading, client/token mismatch, unsafe
file permissions, command allowlisting, and publication denial.

## Verification

- `npx vitest run scripts/google-session.test.ts` — 4 tests passed.
- `npm run google -- preflight` — all Google configuration checks passed.
- Credentialed status and ConsentFlow recognition checks confirmed the saved grant
  reaches `GTM-PCJ3Q5RK`; no mutation was performed.
- `npm run verify` — 40 files / 277 deterministic tests and 43 Chromium tests
  passed.

## Exploratory review

Not applicable: this is a local credential-loading command with no visible product
surface.

## Documentation

README documents the repeat-session files, commands, and publication boundary. Issue
29 records the authorization and regression contract.
