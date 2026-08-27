# Organization authentication

The beta supports one authorized Clerk Organization per backend deployment. Product
identity, organization authority, and Google authorization are separate boundaries:
signing in does not grant Google access, and a Google grant does not grant product
access.

## Role policy

| Clerk role | Product permissions |
| --- | --- |
| Member | Read and write tracking work |
| Admin | Member permissions, Google-connection management, publication, and rollback |

The API resolves an active organization membership on every protected request and
checks the mapped product permission. It does not authorize from an extension origin,
email address, Google account, or raw Clerk role alone.

## Clerk configuration

1. Create the production Clerk application and require organization membership.
2. Keep public signup and organization creation outside the beta product. Add members
   through the approved Clerk operator workflow and use only Member and Admin roles.
3. Enable the hosted email one-time-code sign-in method.
4. Create a public OAuth client that permits authorization code with PKCE and no client
   secret in the extension.
5. Give the extension a stable Chrome ID. Register
   `https://<extension-id>.chromiumapp.org/clerk` as the exact redirect URI.
6. Configure the public client with the minimum scopes needed for sign-in,
   organization membership, and refresh: `openid user:org:read offline_access` unless
   the Clerk dashboard names a narrower equivalent.

Use the endpoints shown by the Clerk application or its OAuth discovery metadata;
do not infer endpoint paths. If production uses a Clerk custom domain, replace the
development `https://*.clerk.accounts.dev/*` extension host permission with that exact
origin before distribution.

## API environment

```text
CLERK_SECRET_KEY=<server secret>
CLERK_PUBLISHABLE_KEY=<matching publishable key>
CLERK_AUTHORIZED_ORGANIZATION_ID=<one exact organization ID>
EXTENSION_ORIGIN=chrome-extension://<stable extension ID>
```

All three Clerk values must be present and valid or protected routes return 503. Never
put `CLERK_SECRET_KEY` in the extension build, browser storage, logs, or screenshots.

## Extension build environment

```text
PRODUCT_AUTHORIZATION_ENDPOINT=https://<clerk-origin>/<authorization-endpoint>
PRODUCT_TOKEN_ENDPOINT=https://<clerk-origin>/<token-endpoint>
PRODUCT_REVOCATION_ENDPOINT=https://<clerk-origin>/<revocation-endpoint>
PRODUCT_OAUTH_CLIENT_ID=<public client ID>
PRODUCT_OAUTH_SCOPE=openid user:org:read offline_access
```

The revocation endpoint is optional but recommended. All configured endpoints must be
HTTPS. The extension build contains only public OAuth configuration.

Chrome owns the hosted sign-in window. The service worker generates and validates
PKCE and state, stores the session in its extension-origin IndexedDB, refreshes before
expiry, and adds the access token only to the fixed local API origin. The content
script runs against the inspected website origin and receives safe role/status results
only. Sign-out clears local state first and attempts provider revocation when
configured.

## Deployment checks

- Build without `NODE_ENV=test`; test tokens are ignored by production builds.
- Confirm the content-script bundle contains no access token, refresh token, client
  secret, member ID, or test-token sentinel.
- Confirm `/health` reports `authenticationConfigured: true`.
- Confirm no token returns 401, a non-member returns 403, Member cannot publish or
  manage Google connections, and Admin can reach those permission gates.
- Confirm the operation store is owner-readable only and contains organization/member
  references but no email, display name, or session token.
- Run `npm audit --omit=dev`, `npm run verify`, and the credentialed Clerk sign-in smoke
  before distributing the extension.

The ordinary test harness uses deterministic sessions only when the API and extension
are built with `NODE_ENV=test`. Production configuration cannot activate that path.
