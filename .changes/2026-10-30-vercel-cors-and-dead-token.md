# Vercel CORS fails closed; dead extension token removed

Change record version: 2

Issue: `.scratch/security-review-findings/issues/05-vercel-cors-default-and-dead-extension-token.md`

## Summary

The Vercel handler now uses the same route-aware `corsDecision` as the local server instead of
defaulting `Access-Control-Allow-Origin` to `*`. The unused `GTM_OBSERVABILITY_EXTENSION_TOKEN`
build define and the workbench call to the removed `resolve-site` route are gone.

## Why

Pre-public hygiene. `api/google/*` functions are already deployed on Vercel; if a Google route
were ever served there it would have inherited a wildcard origin. A build-time token compiled
into a public extension is readable by anyone who installs it, and nothing consumed it.

## Behavior

- Public routes (`/api/health`, `/api/setups`): unchanged for the extension. Every origin and
  origin-free requests get `Access-Control-Allow-Origin: *`, whatever `EXTENSION_ORIGIN` holds.
  Previously a configured `EXTENSION_ORIGIN` was echoed on these routes; `*` matches the local
  server and keeps `npm run build:extension:prod` builds working with or without the variable.
- Google and intake routes on Vercel: origin-free requests pass with no ACAO header; only the
  exact `EXTENSION_ORIGIN` is echoed; any other origin, or any origin when `EXTENSION_ORIGIN` is
  unset, blank, `*` or `null`, gets `403` with no ACAO, including preflights.
- `EXTENSION_ORIGIN` is read per request rather than at module load.
- `Access-Control-Allow-Headers` on Vercel is now `Content-Type` (matching the local server);
  `Authorization` existed only for the removed token.
- The workbench no longer attempts GTM-based GA4 resolution. With the token unset (every shared
  build) that path already returned early, so nothing visible changes.
- Out of scope: serving Google routes from Vercel.

## Regression coverage

New `apps/api/src/vercel.test.ts` (10 tests) drives the exported Vercel handler with real
`Request` objects: no origin, configured origin, other origin, and unset or `*` configuration,
for both `/api/health` and `/api/google/status`, plus prefix-lookalike, `null` origin and
preflight cases. Run against the previous handler, 6 of the 10 fail. No test covered the token
path, so no test was removed.

## Verification

- `npm run verify`: passed (see PR for the output summary).
- `npm run build:extension:prod`: built for `https://gtm-observability.vercel.app`; the bundle
  contains no `EXTENSION_TOKEN`, `resolve-site` or `Authorization` reference.
- Root Vercel entrypoints under `api/` typecheck with `tsc --strict`.

## Exploratory review

No user-visible surface: the change affects HTTP headers on hosted API routes and removes a code
path that never ran in a shared build. The E2E suite in `npm run verify` still exercises the
extension workflows.

## Documentation

`docs/security-and-publishing.md`: replaced the token paragraph and checklist line, documented
that Vercel and the local server share the CORS rule, and added an `EXTENSION_ORIGIN` checklist
item for Vercel.
