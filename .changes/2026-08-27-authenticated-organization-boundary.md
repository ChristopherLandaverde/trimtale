# Authenticate one organization boundary

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/31-authenticated-organization-boundary.md`

## Summary

Added Clerk-backed organization authentication, centrally mapped Member/Admin
permissions, organization-scoped durable tracking operations, and membership-bound
approval receipts for the single-organization beta.

## Why

Extension-origin CORS and Google OAuth identify browser/provider boundaries but do not
prove that a tracking practitioner belongs to the product organization authorized to
read, change, publish, or roll back tracking work.

## Behavior

The website agent can start Clerk's hosted email-code flow through Chrome OAuth/PKCE.
Its service worker keeps session storage in extension-origin IndexedDB and adds a
short-lived token to the fixed local API only. The API verifies the token and exact
active organization membership, defaults browser routes to authenticated, and maps
Member to tracking read/write while Admin adds connection, publication, and rollback
authority. Durable operations are keyed by organization and approval records reference
stable organization membership rather than page or email identity.

Public signup, organization/member management, billing, a control portal,
multi-organization Google token storage, and a database replacement remain out of
scope. Google authorization remains a separate boundary.

## Regression coverage

The shared acceptance fixture drives core authority and API route-policy tests. API
tests cover malformed, absent, expired, pending, wrong-organization, insufficient-role,
production-config, and test-only session boundaries. Repository tests prove colliding
operation IDs remain organization-scoped. Extension units prove exact HTTPS OAuth
configuration, PKCE parameters, and redirect/state validation. Chromium covers Member,
Admin, signed-out, wrong-organization, private-sentinel, and visible sign-in states.
Existing intake-report coverage now protects the internal-only boundary.
The complete extension mount suite guards the resolved storage-isolation regression.

## Verification

- Focused organization/API/extension and full unit suites passed.
- Focused Chromium organization, intake, and navigation journeys: 10 passed.
- `npm audit --omit=dev`: zero reported vulnerabilities.
- `npm run verify`: 461 deterministic tests and 82 Chromium journeys passed.

## Exploratory review

[Authenticated organization boundary review](../docs/reviews/2026-08-27-authenticated-organization-boundary.md)
covered sign-in, wrong organization, Member/Admin authority, attacker-shaped provider
text, credential absence, and existing authorized connection states. No finding
remains.

## Documentation

Updated Issue 31, the setup-engine specification, current capabilities, the domain
glossary, the organization-authentication runbook, and ADR 0006.
