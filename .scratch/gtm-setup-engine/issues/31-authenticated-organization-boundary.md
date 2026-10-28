# Authenticate one organization boundary

Delivery mode: implementation
Status: resolved

## Production outcome

An authenticated tracking practitioner can use the website agent only while their
active organization exactly matches the organization configured for the deployment.
Every protected API action derives its practitioner and organization authority from a
verified short-lived session; browser origin is retained as defense in depth but never
treated as authentication.

The first release is intentionally one organization per backend deployment. Tracking
setup operations and approval receipts are bound to that organization and a stable
organization-membership identity. A missing, expired, pending, wrong-organization, or
insufficient-permission session fails closed before a Google, Analytics, model, or
persistence action.

## Provider boundary

Use Clerk Organizations through Chrome's built-in OAuth authorization-code flow with
PKCE and Clerk's supported backend verifier:

- A website-agent sign-in action starts Clerk's hosted email-code flow in Chrome through
  `chrome.identity.launchWebAuthFlow`. The service worker owns access and refresh
  tokens and adds the access token only to protected API requests. Page content and
  content-script messages never receive either token.
- The API verifies the session token with Clerk's supported backend verifier and
  requires an active user, active organization membership, exact configured
  organization ID, and the product permission required by the route.
- Clerk's free Admin and Member roles map centrally to product permissions: Member can
  read and write tracking work; Admin adds Google-connection management, publication,
  and rollback. Routes check the resulting product permission, not the raw provider
  role.
- Approval receipts store stable organization and membership identifiers, never an
  email address, display name, browser origin, or the current
  `website_chat_human` placeholder.
- OAuth state is bound to the authenticated organization that started the connection;
  the callback cannot select or switch organizations.

## Permissions

- `org:tracking:read`: inspect connection context and organization-owned operations.
- `org:tracking:write`: author, plan, apply, validate, verify, version, repair, and
  apply separately reviewed GA4 configuration.
- `org:tracking:publish`: approve publication, publish, verify live evidence, and
  explicitly approve rollback.
- `org:connections:manage`: start or replace the organization's Google connection.

The authorization check uses exact product permissions. This keeps route policy stable
if the provider role model changes later.

## Protected resources

- Google connection status, discovery, container context, workspace operations, GA4
  reads/writes, verification handles, and tracking workflows.
- Model-backed setup authoring and its paid provider call.
- Durable tracking setup operations and approval receipts.
- Internal intake-evaluation reports require a later explicit operator permission and
  remain unavailable to ordinary organization members in this slice.

`GET /health` and the identity provider's validated callback mechanics remain public.
Every other browser API route defaults to authenticated unless its issue explicitly
defines a narrower public contract.

## Regression contract

- Acceptance fixture: `tests/acceptance/authenticated-organization-boundary.json`
  names the public routes, permissions, session cases, and forbidden persisted
  identity values.
- Core tests validate organization authority and versioned operation ownership,
  including migration of legacy operations into an explicitly configured owner
  organization rather than silently assigning a caller-selected organization.
- `apps/api/src/organization-auth.test.ts` proves no-session, expired, pending,
  wrong-organization, missing-permission, malformed-token, and test-boundary behavior.
  Existing CORS regressions retain the exact-origin browser boundary.
- `apps/api/src/tracking-operations.test.ts` creates colliding operation IDs in two
  organizations and proves create, get, list, and update remain scoped. All workflow
  transitions use that scoped repository abstraction.
- Chromium will cover signed-out, wrong-organization, read-only, and authorized
  practitioner states without exposing tokens or member identifiers in the page in
  `tests/e2e/authenticated-organization-boundary.spec.ts` and existing connection-card
  journeys.

## Non-goals

- Public signup, organization creation, invitations, member administration, billing,
  SSO, or a complete control portal.
- Multi-organization Google-token storage inside one backend deployment.
- Replacing the file-backed operation store with Postgres in the same slice.
- Treating a Clerk role, extension origin, email, or Google account as product
  authorization by itself.
- Storing session tokens, identity-provider payloads, emails, names, or credentials in
  tracking operations, logs, screenshots, or browser evidence.
- Granting any GTM, GA4, publication, or rollback authority merely because sign-in
  succeeded.

## Authorization

The user authorized Clerk Organizations with email one-time-code sign-in for the
single-organization beta on 2026-08-27. The implementation must remain within Clerk's
free Admin/Member organization boundary. A later multi-organization release requires
a tenant-aware database and Google-connection store rather than widening this issue.

## Answer

The single-organization product boundary is implemented. Chrome opens Clerk's hosted
OAuth/PKCE flow, the extension service worker owns the product session, and every
browser API defaults to exact-origin plus verified organization authorization. Member
can read/write tracking work; Admin separately adds Google-connection, publication,
and rollback authority. Tracking operations are organization-scoped and approval
receipts store stable organization-membership references without private identity or
session values.

## Comments

- 2026-08-27: Repository audit found that exact extension-origin CORS checks protect
  browser boundaries but do not authenticate a person. GA4, managed-replacement, and
  publication approval receipts currently use `website_chat_human`.
- 2026-08-27: Current official provider review found a supported Clerk Chrome-extension
  SDK, short-lived backend session tokens, active Organization context, and custom
  permissions. Supabase offers Chrome-extension authentication and Postgres RLS but
  would require a separate organization-membership product model. Clerk is proposed
  for the narrower first identity slice; durable multi-tenant storage remains separate.
- 2026-08-27: Installing the current Clerk Chrome-extension SDK introduced 20 reported
  transitive vulnerabilities, including eight high severity, through unused wallet and
  React-Native dependencies. The dependency was removed. The accepted implementation
  instead uses Chrome's native OAuth/PKCE boundary and Clerk's official backend
  verifier; `npm audit --omit=dev` returned zero findings after removal.
- 2026-08-27: Implemented the API verifier and default route policy, native
  service-worker OAuth/PKCE boundary, extension-origin token storage, Member/Admin
  permission mapping, organization-scoped operation persistence, membership-bound
  approval references, and explicit signed-out/wrong-organization UI. Focused unit and
  Chromium regressions pass.
- 2026-08-27: Final `npm run verify` passed 461 deterministic tests and 82 Chromium
  journeys. Production dependency audit reports zero vulnerabilities. Exploratory
  review found and resolved one content-script storage isolation failure; no finding
  remains. Issue resolved.
