# Share the Playwright extension fixture

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/27-shared-playwright-extension-fixture.md`

## Summary

Moved every unpacked-extension browser suite to one isolated Playwright fixture.

## Why

Extension suites duplicate persistent-browser setup and cleanup, weakening isolation
and trace consistency.

## Behavior

- Each extension test launches the built extension in a fresh persistent Chromium
  context and temporary profile.
- The fixture always closes Chromium and removes the profile.
- Playwright retains traces only for failures.
- Existing role/label actions, screenshots, downloads, and mocked Google boundaries
  are unchanged.
- Authorization and container-recognition scenarios now run as isolated tests.
- A fixed delay was replaced with a page-ready condition.

## Regression coverage

The shared fixture runs navigation, conversation intake, lead-form setup, connection
context, and connected-verification journeys. The complete Playwright catalog remains
the delivery gate.

## Verification

- Red: the first 23-test extension run exposed duplicate trace ownership because the
  fixture and Playwright both started tracing.
- Green: the same 23 extension journeys passed after leaving trace ownership with
  Playwright.
- Full `npm run verify`: 273 deterministic tests and 41 Chromium journeys passed.

## Exploratory review

Not applicable: this changes test infrastructure, not the user-visible product.

## Documentation

Updated the delivery harness and MVP handoff with the shared-fixture boundary.
