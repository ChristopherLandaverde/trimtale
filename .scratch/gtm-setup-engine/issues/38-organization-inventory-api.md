# Organization container inventory API

Delivery mode: implementation
Status: resolved

## Production outcome

A signed-in organization member can request one read-only GTM web-container inventory.
The API captures accounts, containers, live versions, workspaces, effective-access
status, and GA4 destination context, compares it with the organization's prior durable
snapshot, and reports newly observed differences without claiming website impact.

## Non-goals

- The visual portal page; it follows this trusted read-model slice.
- Tag, trigger, variable, workspace, version, or GA4 mutation.
- Requesting the broader GTM user-management scope or inferring ACLs.
- Scheduled capture, alerts, or runtime-regression claims.

## Authorization

The practitioner requested continuation with the next product slice on 2026-08-27.
Issue 08 already defines the portal inventory outcome and has continuous Stage 1
implementation authorization. This issue claims its first independently reviewable
read-only boundary.

## Regression contract

- `apps/api/src/container-inventory-api.test.ts` requires the first authorized capture
  to establish a baseline and the next capture to report exact live-version and
  workspace changes with `impactAssessment: not_assessed`.
- The same tests require organization and Google-connection isolation, durable atomic
  persistence, clone-safe reads, stale-snapshot rejection, and fail-closed invalid
  provider output.
- `apps/api/src/organization-auth.test.ts` continues to protect member read access and
  reject unauthenticated or cross-organization requests.

## Comments

- 2026-08-27: Claimed as the next unblocked Stage 1 slice. The core inventory contract,
  comparator, and Google capture client exist; no authenticated API currently composes
  them into a durable organization read model.
- 2026-08-27: Failing-first coverage began with no inventory API module. The corrected
  service, repository, organization-auth, Google discovery, and core inventory suites
  pass 33 focused tests.
- 2026-08-27: Resolved after `npm run verify` passed all 469 deterministic tests and
  87 Chromium end-to-end journeys. The visual portal remains the next Issue 08 slice.
