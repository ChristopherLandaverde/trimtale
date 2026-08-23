# Local API server defaults to an open CORS origin

Status: resolved

## Objective

`apps/api/src/server.ts:11` sets `allowedOrigin = process.env.EXTENSION_ORIGIN ?? "*"`.
`EXTENSION_ORIGIN` is never set anywhere in this repo (no `.env.example`, README,
or config references it), so every real run of `npm run dev:api` serves
`Access-Control-Allow-Origin: *` on every response, including
`/api/google/accounts` and `/api/google/accounts/:id/containers/:id/context`.

The server binds to `127.0.0.1` only, but that does not protect it here: once a
user has connected Google OAuth (`/api/google/oauth/callback`), the access token
is held server-side and any origin's unauthenticated `fetch()` is enough to read
GTM account/container/live-version data — no credentials, cookies, or extra
header are required to satisfy this CORS policy. In practice, JavaScript
running in *any browser tab* on the user's machine (not just the extension) can
call `fetch("http://127.0.0.1:8787/api/google/accounts")` and read the response,
because a plain cross-origin GET with `ACAO: *` is exactly what CORS is
designed to allow. This is the classic "wildcard CORS on a localhost service"
data-exfiltration pattern.

The shipped extension service worker now calls the container-recognition and
workspace-preparation endpoints on port 8787. The unsafe default therefore affects
the active integration boundary, in addition to standalone `dev:api` use.

## Regression contract

Required test level: deterministic unit test under the ordinary `npm test` gate,
alongside the existing `apps/api/src/google.test.ts` / server tests.

Required invariants:

- Positive: with `EXTENSION_ORIGIN` unset, a request from a disallowed origin
  does not receive a permissive `Access-Control-Allow-Origin` header — the
  server must refuse to default to `*` for the Google-data routes.
- Positive: with `EXTENSION_ORIGIN` set to a specific value (e.g. the packed
  extension's `chrome-extension://<id>` origin), only that origin is echoed
  back in `Access-Control-Allow-Origin`.
- Negative: a request whose `Origin` header does not match the configured
  extension origin must not be able to read `/api/google/accounts` or
  `/api/google/accounts/:id/containers/:id/context` via CORS.

## Work

- Require `EXTENSION_ORIGIN` to be explicitly configured for the Google routes
  (or default to reflecting a documented, narrow allowlist such as
  `chrome-extension://*` origins only) instead of defaulting to `"*"`.
- Document the required `EXTENSION_ORIGIN` value in the README section that
  already documents the read-only Google integration.
- Add the regression test above.
- Add a concise change record.

## Done when

- The regression contract runs in `npm test`.
- `npm run verify` passes.
- README documents how `EXTENSION_ORIGIN` must be set for a real deployment.

## Comments

- 2026-08-22: Claimed for implementation. The regression contract will exercise
  the pure route-boundary policy used by the HTTP server, covering unconfigured,
  exactly matched, mismatched, and explicit-wildcard origins without opening a
  test socket.
- 2026-08-22: Added the shared server policy and four boundary tests covering all
  Google route families, exact extension-origin matching, ordinary and deceptive
  attacker origins, unset and wildcard configuration, origin-free callbacks, and
  unchanged non-Google routes. `npm run agent -- verify` passed 118 deterministic
  tests and all 25 Chromium workflows.
- 2026-08-22: Real HTTP smoke checks against the built server confirmed the same
  headers and status codes at the network boundary: exact origin echoing, `403`
  without ACAO for attacker origins, no ACAO for origin-free clients, and unchanged
  public `/health` CORS behavior.

## Answer

Google-backed localhost routes now fail closed for browser origins unless
`EXTENSION_ORIGIN` is configured and exactly matches the request. Disallowed
requests receive `403` without an access-control allow-origin header; direct OAuth
navigation and server-side requests without `Origin` remain available.
