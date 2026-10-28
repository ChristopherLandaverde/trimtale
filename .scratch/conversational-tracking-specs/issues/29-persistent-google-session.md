# Persist the local Google workflow session

Delivery mode: implementation

Status: resolved

## Production outcome

Future local sessions can preflight or start the Google-enabled API with one command,
reusing owner-only OAuth client and refresh-token files without copying credentials
into prompts or ephemeral shells.

## Non-goals

- Storing credentials in Git or printing their values.
- Enabling publication, requesting new scopes, or contacting Google during preflight.
- Replacing practitioner OAuth with a service account.
- Running a live GTM mutation in this slice.

## Authorization

The product owner requested reuse of the previously granted ConsentFlow Google access
without repeating client-credential setup on 2026-08-23.

## Regression contract

- `scripts/google-session.test.ts` proves owner-only files load only when the OAuth
  client, saved token binding, refresh token, and extension origin are valid.
- The launcher forces publication switches off and never includes credential values in
  validation errors.
- The repository command accepts only `preflight` and `api` modes.
- `npm run google -- preflight` passes with the secured local configuration.

## Comments

- 2026-08-23: Claimed after locating the matching downloaded OAuth client and bound
  refresh-token store.
- 2026-08-23: Secured the client, token, and extension-origin files with mode `0600`.
  Focused tests and Google preflight passed. The saved grant recognized ConsentFlow
  container `GTM-PCJ3Q5RK` and live version 3 without re-consent or mutation.
- 2026-08-23: Resolved after `npm run verify` passed 277 deterministic tests and 43
  Chromium journeys.
