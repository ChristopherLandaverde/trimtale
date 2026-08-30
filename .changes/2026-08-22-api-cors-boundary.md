# Fail closed at the Google API CORS boundary

Change record version: 2

Issue: `.scratch/security-review-findings/issues/01-api-cors-wildcard-default.md`

## Summary

Google-backed localhost API routes now grant browser access only to the exactly
configured extension origin instead of defaulting to wildcard CORS.

## Why

A wildcard response allowed any browser tab to read Google Tag Manager data from the
localhost service after OAuth was connected.

## Behavior

Google routes reject browser requests when `EXTENSION_ORIGIN` is missing, wildcard,
or mismatched, and echo the origin only on an exact match. Requests without an
`Origin` header remain available for direct OAuth navigation and server-side tools.
The public CORS behavior of `/health` and `/api/setups` is unchanged.

## Regression coverage

`apps/api/src/cors.test.ts` covers unconfigured and explicit-wildcard defaults, exact
extension-origin matching, attacker-origin rejection, origin-free callbacks, and the
unchanged non-Google route policy.

## Verification

Focused CORS coverage passed with 4 tests. `npm run agent -- verify` passed the
change-documentation and TypeScript gates, all 118 deterministic tests, every
workspace build, and all 25 Chromium workflows. Short-lived localhost HTTP smoke
checks confirmed `403` without an allow-origin header for unconfigured and deceptive
origins, exact echoing for the configured extension origin, origin-free Google-route
access, and unchanged wildcard behavior for `/health`.

## Exploratory review

Not applicable. This is an API security-boundary change with no built-product visual
or interaction change; deterministic boundary tests and the full browser gate provide
the relevant evidence.

## Documentation

The README now requires the exact unpacked extension origin and documents fail-closed
Google-route behavior.
