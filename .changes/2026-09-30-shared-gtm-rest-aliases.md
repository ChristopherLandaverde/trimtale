# Share GTM REST aliases

Change record version: 2

Issue: `.scratch/security-review-findings/issues/04-duplicated-gtm-rest-alias-tables.md`

## Summary

Moved GTM import-to-REST alias mappings into one core module used by semantic change
planning and Google request construction.

## Why

The duplicated tables could drift and make planning disagree with the request body
sent to Google. One definition keeps comparison and application aligned.

## Behavior

Supported mappings and user-visible behavior are unchanged. Live Google access,
provider writes, publication, and additional aliases remain out of scope.

## Regression coverage

`apps/api/src/google-application.test.ts` adds a test-only canary alias and proves the
same addition controls both semantic reuse and the outgoing REST trigger body.

## Verification

- `npm run build --workspace @gtm-observability/core`
- `npm run typecheck --workspace @gtm-observability/api`
- `npx vitest run packages/core/src/change-plan.test.ts apps/api/src/google-application.test.ts`
  — 19 tests passed.
- `npm run verify` — 483 deterministic tests and 95 Chromium journeys passed.
- `npm run check:change-docs -- --base 0a97e5724988ab22f494e249e4de18bbc5a6949c`
  — 108 change records valid.

## Exploratory review

Not applicable. This internal data consolidation has no user-visible surface and does
not change an existing mapping.

## Documentation

The security finding records the authorized production outcome and scope. The domain
glossary and ADRs are unchanged because this introduces no domain concept or
architectural decision.
