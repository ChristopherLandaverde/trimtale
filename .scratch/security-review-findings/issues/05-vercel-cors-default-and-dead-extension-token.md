# Vercel CORS defaults open; dead extension token is still compiled in

Status: resolved

## Objective

Found in the pre-public audit.

- `apps/api/src/vercel.ts` set `Access-Control-Allow-Origin` from
  `process.env.EXTENSION_ORIGIN ?? "*"` on every route. The local server already
  uses the route-aware, fail-closed `corsDecision` in `apps/api/src/cors.ts`; the
  Vercel functions did not. `api/google/status.ts` and `api/google/gtm/accounts.ts`
  are deployed Vercel functions, so a Google route served there would have
  inherited the wildcard.
- `GTM_OBSERVABILITY_EXTENSION_TOKEN` was compiled into the extension bundle by
  `apps/extension/build.mjs` and sent as a bearer token by `apps/extension/src/workbench.ts`
  to `POST /api/google/gtm/resolve-site`. That route was removed from `apps/api/src/app.ts`
  in c340e21 and exists nowhere in the API, so the token path is dead code that
  invites shipping a secret in a public extension.

## Regression contract

Required test level: deterministic unit test under the ordinary `npm test` gate.

Test file: `apps/api/src/vercel.test.ts`, exercising the exported Vercel handler with
real `Request` objects and `EXTENSION_ORIGIN` stubbed per case.

- Public route (`/api/health`, `/api/setups` preflight): served with
  `Access-Control-Allow-Origin: *` for no origin, the configured origin, another origin,
  and with `EXTENSION_ORIGIN` unset or `*`.
- Google route (`/api/google/status`): no-origin requests pass without an ACAO header; the
  exactly configured origin is echoed; another origin, a prefix lookalike, and `null`
  receive `403` without ACAO; unset, `*`, `null` and blank configuration refuse every
  browser origin, including preflights.

## Done when

- The regression contract runs in `npm test`.
- No reference to `GTM_OBSERVABILITY_EXTENSION_TOKEN` or `resolve-site` remains in code or docs.
- `npm run verify` passes.

## Comments

- 2026-10-30: Confirmed `resolve-site` is absent from `apps/api` and the token has no other
  consumer. Removed the define, the workbench call and its status message. The Vercel handler
  now calls `corsDecision` and reads `EXTENSION_ORIGIN` per request. The new tests fail
  6 of 10 against the previous handler and pass against the new one.

## Answer

Vercel and the local server now share one CORS policy. The extension bundle compiles in only
the API base URL.
