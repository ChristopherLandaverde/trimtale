# Add a real React form journey

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/31-real-react-form-journey.md`

## Summary

Added one real React-rendered lead form to the deterministic fixture and drove the
unchanged built extension through its complete browser-verification path.

## Why

SPA-like fixtures do not prove that the existing workflow works with React-rendered
forms and synthetic submit handling.

## Behavior

- React 19.2.8 mounts the form with `createRoot` and handles submit through React.
- An empty required field produces no success state or analytics request.
- A valid submit performs an SPA history transition, renders visible success, and emits
  one metadata-only `generate_lead` request.
- No React-specific extension, domain, GTM, or Google behavior was added.

## Regression coverage

`tests/e2e/react-form.spec.ts` proves the React runtime, dynamic render, native
validation, visible success, SPA route transition, one required-parameter request,
passing browser verdict, and submitted-value privacy.

## Verification

- The React journey failed before the route and runtime existed, then passed after the
  fixture was added.
- The empty-field assertion failed before native validation was required, then passed.
- `npm run verify` passed 278 deterministic tests across 40 files and 45 Chromium
  journeys.

## Exploratory review

[Real React form review](../docs/reviews/2026-08-23-real-react-form.md) covered the valid,
empty-field, and private-value paths. No finding remains.

## Documentation

The accepted specification, MVP handoff, and issue 31 record the bounded React
compatibility claim and non-goals.
