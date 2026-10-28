# Add separately approved GA4 configuration actions

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/07-ga4-configuration.md`

## Summary

Add exact GA4 plans, fresh-state approval binding, Admin API application, and one
receipt per Enhanced Measurement, custom-definition, metric, or key-event action.

## Why

GA4 configuration is separate provider state and must never be implicitly authorized
by a GTM workspace change.

## Behavior

Plans target one property and web stream, bind approval to the plan and provider-state
fingerprints, expire after thirty minutes, and fail on drift. Application re-reads the
property, creates only approved resources, rejects conflicting definitions, re-reads
after each action, and returns independent receipts.

## Regression coverage

`packages/core/src/ga4-configuration.test.ts` and `apps/api/src/analytics.test.ts`
cover target binding, drift, expiry, event scope, currency restrictions, exact Admin
API requests, conflicts, and receipts.

## Verification

`npm run verify` passes 369 unit tests and 51 Playwright Chromium journeys.

## Exploratory review

Not yet applicable. Authenticated chat review and approval routes depend on the portal
identity contract and remain tracked by Issues 07 through 09.

## Documentation

The provider fields and enums were checked against the current official Google
Analytics Admin API references before implementation.
