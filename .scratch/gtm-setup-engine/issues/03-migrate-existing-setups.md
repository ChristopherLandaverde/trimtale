# Migrate navigation and lead-form setups

Delivery mode: implementation
Status: resolved

## Production outcome

Navigation and confirmed lead-form setups use the generic contract and compiler while
preserving their current visible behavior, artifacts, safety boundaries, and browser
evidence.

## Non-goals

- A new customer workflow.
- Deleting the existing paths before parity is proved.
- Weakening current acceptance or E2E tests.

## Authorization

The user authorized continuous Stage 1 implementation on 2026-08-24.

## Regression contract

- `packages/core/src/setup-adapters.test.ts` proves navigation and all four lead-form
  evidence modes validate and compile through the generic boundary.
- All existing navigation and conversational-form acceptance and Chromium journeys
  remain in the ordinary harness.
- Page-scoped, phone-click, and custom-data-layer fixtures add no event-specific
  production branch.

## Dependencies

- Issues 01 and 02.

## Resolution

- Current navigation and form entry points now adapt into `TrackingSetupV1` and call
  the generic compiler.
- Event-specific GTM entity generation was removed from `generator.ts`.
- `npm run verify` passes 326 unit tests and 51 Playwright Chromium journeys.
