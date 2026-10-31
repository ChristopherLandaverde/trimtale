# Refuse unknown routes by default in the CORS check

Status: resolved

## Objective

Close the route-prefix CORS bypass identified in review note #68. Mixed-case and
percent-encoded Google and intake paths must not receive the public wildcard CORS
decision before any Google route is served from Vercel.

## Regression contract

Required test level: deterministic API unit tests under `npm test`.

Test files: `apps/api/src/cors.test.ts` and `apps/api/src/vercel.test.ts`.

- Positive: `/health`, `/api/health`, and `/api/setups` retain wildcard CORS.
- Positive: exact Google and intake route prefixes retain exact configured
  extension-origin behavior, and origin-free requests do not receive ACAO.
- Negative: mixed-case and percent-encoded Google and intake paths, and other
  unknown paths, return a refused CORS decision in the pure policy and the Vercel
  handler.

## Done when

- The regression contract runs under `npm test`.
- Change record documents verification, including the unavailable browser E2E run.

## Comments

- 2026-10-30: Added regression tests before implementation. The public-route
  allowlist is `/health`, `/api/health`, and `/api/setups`; unknown paths fail
  closed through the shared policy.
- 2026-10-30: Implemented the allowlist and confirmed the pure policy plus Vercel
  handler regressions pass. `npm run check:change-docs`, `npm run check`, and
  `npm test` passed (45 files, 419 tests). Browser E2E was skipped because
  browsers are unavailable in the sandbox.
