# Refuse unknown routes by default in the CORS check

Change record version: 2

Issue: `.scratch/security-review-findings/issues/06-cors-unknown-routes.md`

## Summary

Restrict wildcard CORS to `/health`, `/api/health`, and `/api/setups`. Unknown paths
now fail closed through the shared CORS policy used by the local server and Vercel.

## Why

Case-sensitive route prefix checks classified mixed-case and percent-encoded Google
and intake paths as public. An explicit public-route allowlist prevents those paths
and future unknown routes from inheriting wildcard CORS.

## Behavior

The three public routes retain wildcard CORS. Google and intake route prefixes retain
their exact extension-origin boundary, including origin-free requests without ACAO.
All other paths receive a refused CORS decision. No user-visible workflow changes.

## Regression coverage

`apps/api/src/cors.test.ts` covers the allowlist, sensitive route behavior, and
unknown/mixed-case/encoded paths. `apps/api/src/vercel.test.ts` exercises equivalent
attacker-shaped paths through the Vercel handler and confirms refusal.

## Verification

- `npm ci` — passed; 54 packages added, 0 vulnerabilities.
- `npm run check:change-docs` — passed; change documentation valid (66 records).
- `npm run check` — passed; core build and type checks passed across all workspaces.
- `npm test` — passed; 45 test files and 419 tests passed.
- `npm run test:e2e` was skipped as requested because browsers are unavailable in
  this sandbox.

## Exploratory review

This security boundary change has no user-visible surface, so interactive Chromium
review is not applicable.

## Documentation

Added the issue regression contract under `.scratch/security-review-findings/` and
this change record. No domain glossary or operational documentation changes were
needed.
