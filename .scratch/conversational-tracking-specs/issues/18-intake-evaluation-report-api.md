# Add the read-only intake evaluation report API

Status: resolved

## Objective

Expose privacy-safe model-comparison reports through extension-origin-protected GET
routes so a frontend can render aggregate and case evidence without gaining any way to
start provider execution or modify the report store.

## Regression contract

Required test level:

- Deterministic route and persistence-boundary tests in
  `apps/api/src/intake-evaluation-api.test.ts` under `npm test`.
- CORS boundary regressions in `apps/api/src/cors.test.ts`.
- Built-server coverage in `tests/e2e/intake-evaluation-api.spec.ts`.

Required fixtures and cases:

- Empty: an absent report file returns an empty versioned list.
- Positive list: valid reports return newest-first summaries containing aggregate
  outcome, score, latency, and usage metrics but no per-case data.
- Positive detail: a valid opaque report ID returns the complete validated compact
  report, including safe case outcomes and dimensions.
- Negative: an unknown valid ID returns 404; an invalid route shape returns no match;
  non-GET methods on recognized report routes return 405.
- Fail closed: malformed JSON, unsupported schemas, invalid reports, and duplicate
  reports return one generic 503 response without file content or validation detail.
- Boundary: browser requests require the exact configured extension origin; missing,
  wildcard, null, attacker, and prefix/suffix origins are denied while originless local
  requests remain supported.
- Privacy: neither list nor detail responses contain messages, labels, interpretations,
  prompts, credentials, raw responses, Authorization headers, exception text, or
  private sentinels.

Required invariants:

- Only GET list/detail behavior is added. The route module imports no provider adapter,
  runner, command, model SDK, or credential and performs no write.
- Each request reopens and runtime-validates the report collection so reports written
  by the separate owner command become visible without restarting the API.
- List responses omit case rows; detail responses return only the already validated
  compact report contract.
- No public CORS wildcard is permitted for report routes.
- No extension UI, provider call, GTM mutation, or publication behavior is added in
  this slice.

## Work

- Define the versioned read-only list summary and route result.
- Implement list/detail routing over the existing report repository with generic
  fail-closed errors and per-request refresh.
- Connect the routes to the local API server and configure the report store path.
- Extend CORS protection and document the frontend-facing contract.

## Done when

- Empty, list, detail, method, not-found, corruption, refresh, CORS, and privacy tests
  pass in the ordinary harness.
- `npm run verify` and the exact-base change-documentation check pass.

## Comments

- 2026-08-23: Claimed after PR 41 merged the dormant owner-operated report producer.
  This slice is deliberately read-only and cannot invoke that producer.
- 2026-08-23: Added list/detail route results, newest-first summaries, fresh per-request
  repository reads, generic unavailable errors, explicit read-only methods, server
  wiring, and exact-origin CORS protection. Ten focused route and CORS regressions pass,
  and API strict TypeScript checking passes.
- 2026-08-23: `npm run verify` passed local preflight, change documentation, every
  workspace build and strict check, 264 deterministic tests across 37 files, and 27
  Chromium workflows including the real loopback route/CORS/no-write journey. No model
  provider or external request ran. Interactive visual review is deferred to the next
  frontend slice because this API has no rendered surface.
