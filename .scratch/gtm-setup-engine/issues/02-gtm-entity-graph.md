# Generic GTM entity graph and compiler

Delivery mode: implementation
Status: resolved

## Production outcome

A deterministic compiler converts one confirmed generic setup into a dependency-safe
graph of tags, triggers, variables, templates, and Custom HTML entities suitable for
the existing tracking change planner.

## Non-goals

- Language interpretation.
- Provider mutation or publication.
- Server-side or mobile GTM.

## Authorization

The user authorized continuous Stage 1 implementation on 2026-08-24.

## Regression contract

- `packages/core/src/setup-compiler.test.ts` covers condition grouping, exceptions,
  variable references, entity ordering, consent settings, and malformed dependencies.
- Page-scope, phone-click, and custom-data-layer fixtures compile through one function.
- The existing semantic change planner recognizes compiled entities after GTM IDs and
  trigger references change.

## Dependencies

- Issue 01.

## Resolution

- `packages/core/src/setup-compiler.ts` produces the dependency graph and GTM export.
- `packages/core/src/setup-compiler.test.ts` passes seven compiler regressions.
- `npm run verify` passes 326 unit tests and 51 Playwright Chromium journeys.
