# Authenticate one organization boundary

Delivery mode: specification
Status: proposed; awaiting identity-provider authorization

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

## Proposed provider boundary

Use Clerk's supported Chrome-extension client and Organizations session claims:

- The extension service worker obtains the current short-lived session token and adds
  it as a bearer token only to protected API requests. Page content and content-script
  messages never receive the token.
- The API verifies the session token with Clerk's supported backend verifier and
  requires an active session, active organization, exact configured organization ID,
  and the permission required by the route.
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

The authorization check uses exact permissions rather than inferring product authority
from a broad provider role. A member may hold more than one permission.

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
  will name the public routes, permissions, session cases, and forbidden persisted
  identity values.
- Core tests will validate organization authority and versioned operation ownership,
  including migration of legacy operations into an explicitly configured owner
  organization rather than silently assigning a caller-selected organization.
- API tests will prove no-session, expired, pending, wrong-organization,
  missing-permission, malformed-token, and attacker-origin requests cause no provider
  call or persistence write. Exact valid sessions will prove each permission family.
- Repository tests will create colliding operation IDs in two organizations and prove
  get, list, update, approval, publication, and rollback cannot cross the configured
  organization boundary.
- Chromium will cover signed-out, wrong-organization, read-only, and authorized
  practitioner states without exposing tokens or member identifiers in the page.

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

## Decision required

Authorize Clerk Organizations as the first identity provider and the one-organization-
per-deployment boundary above. A later multi-organization release will require a
tenant-aware database and Google-connection store rather than widening this issue.

## Comments

- 2026-08-27: Repository audit found that exact extension-origin CORS checks protect
  browser boundaries but do not authenticate a person. GA4, managed-replacement, and
  publication approval receipts currently use `website_chat_human`.
- 2026-08-27: Current official provider review found a supported Clerk Chrome-extension
  SDK, short-lived backend session tokens, active Organization context, and custom
  permissions. Supabase offers Chrome-extension authentication and Postgres RLS but
  would require a separate organization-membership product model. Clerk is proposed
  for the narrower first identity slice; durable multi-tenant storage remains separate.
