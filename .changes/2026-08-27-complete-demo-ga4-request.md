# Complete the demo GA4 request

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/37-complete-demo-ga4-request.md`

## Summary

The controlled demo now emits a complete privacy-safe `generate_lead` request with
the required form ID, form name, and page location.

## Why

Submitting the demo form produced a correct missing-required-parameter verdict because
its simulated request contained only the event name.

## Behavior

The demo beacon now includes `form_id=demo-lead`, `form_name=Demo lead form`, and the
current page URL. It still uses a controlled intercepted request and excludes the
entered email and all other form values. Production GTM generation, evidence parsing,
and verdict rules are unchanged.

## Regression coverage

`scripts/stage1-interactive-demo.test.ts` requires all three parameters and guards
against reading the email field into the request. Existing form-evidence and verdict
tests continue to require the production contract rather than allowing the demo to
bypass it.

## Verification

- Failing-first demo contract: reproduced the incomplete request.
- Corrected demo, evidence, and verdict suites: 42 tests passed.
- Fresh corrected visible demo launch: passed.
- Final `npm run verify`: 466 deterministic tests and 87 Chromium journeys passed.

## Exploratory review

See `docs/reviews/2026-08-27-complete-demo-ga4-request.md`. The corrected fresh demo,
missing-parameter rejection, and privacy boundary were reviewed. No unresolved finding
remains.

## Documentation

Updated the setup-engine acceptance criteria, current capabilities, Issue 37, and the
exploratory review.
