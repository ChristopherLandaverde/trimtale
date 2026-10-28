# Share the Playwright extension fixture

Delivery mode: implementation

Status: resolved

## Production outcome

Every built-extension browser journey uses one isolated Playwright fixture for the
real unpacked extension, temporary profile cleanup, and failure traces.

## Non-goals

- Changing product behavior or acceptance expectations.
- Adding another browser automation library.
- Adding artificial typing, mouse movement, or fixed delays.
- Running credentialed Google mutation in the ordinary gate.
- Adding a React dependency in this slice.

## Authorization

The product owner requested that realistic Playwright behavior become part of the
engineering workflow on 2026-08-23.

## Regression contract

- Existing suites under `tests/e2e/` retain their visible role/label interactions,
  negative paths, adversarial paths, downloads, network evidence, and screenshots.
- `tests/e2e/helpers/extension-test.ts` owns persistent Chromium launch, one temporary
  profile per test, cleanup, and retained failure traces.
- `playwright.config.ts` retains traces only for failures instead of every passing test.
- `npm run test:e2e` proves all migrated journeys remain isolated and behaviorally
  unchanged.

## Comments

- 2026-08-23: Claimed before test-infrastructure implementation.
- 2026-08-23: First execution failed because both the fixture and Playwright owned
  tracing. The failure produced a retained trace; duplicate tracing was removed.
- 2026-08-23: All 23 migrated extension journeys passed with isolated profiles.
- 2026-08-23: Full verification passed: 273 deterministic tests and 41 Chromium
  journeys. Issue resolved.
