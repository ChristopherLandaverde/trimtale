# Consider API workflow handler extraction

Status: resolved

## Problem

`apps/api/src/server.ts` now owns planning, resume, publish, browser-verification,
rollback, and other Google routes in one file. Extraction may help, but only after
extension-side refactors reduce the active churn.

## Regression Contract

- Extract route handlers only if it improves clarity without changing routes, status
  codes, or bounded error messages.
- Preserve OAuth, CORS, feature flags, and local API paths exactly.
- Run `npm test` and `npm run test:e2e`.
- Run `npm run verify` before resolving.

## Acceptance Criteria

- [x] Handler extraction is either completed with identical behavior or explicitly
      deferred with rationale.
- [x] No endpoint path, status code, or safety guard changes.

## Resolution Notes

- Added `apps/api/src/workflow-routes.ts` for the `/api/google/workflows/*`
  handler set.
- Updated `apps/api/src/server.ts` to delegate workflow routes after the existing
  OAuth/container routes and before the remaining context/setup routes.
- Preserved route paths, bounded errors, status code mapping, OAuth availability
  checks, and feature-flag behavior.
