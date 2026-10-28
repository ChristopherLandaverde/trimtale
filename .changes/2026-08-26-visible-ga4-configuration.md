# Connect visible GA4 configuration

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/07-ga4-configuration.md`

## Summary

Added a separate website-agent review and approval path for the `form_name` custom
dimension and `generate_lead` key event associated with a confirmed lead setup.

## Why

Practitioners need the Analytics configuration that makes useful event parameters and
key events available without treating GTM approval as permission to change GA4.

## Behavior

When Analytics writes are enabled for one exact connected stream, the approved form
setup offers a separate GA4 review. The backend fresh-reads the property, returns an
exact plan, creates approval only from the final visible apply action, rechecks state,
and returns validated per-action receipts. GTM planning, mutation, publication,
reporting, attribution, custom-metric authoring, and real-provider proof remain
unchanged or out of scope.

## Regression coverage

`tests/e2e/ga4-configuration.spec.ts` covers exact property/action review, no mutation
before approval, no GTM workflow request, validated success receipts, provider-state
rejection, continued GTM actions, and exclusion of attacker-shaped page input. Existing
core and API tests retain exact target, approval, drift, and receipt contracts.

## Verification

`npm run verify` passed preflight and documentation checks, all workspace typechecks,
411 deterministic tests across 51 files, all builds, and 66 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-visible-ga4-configuration.md`. Headed Chromium covered
approved application, stale provider state, and attacker-shaped page input. The initial
crowded measurement label was shortened and the review repeated. No unresolved blocker
or high-severity finding remains.

## Documentation

Updated the setup-engine acceptance criteria, implementation issue, current handoff,
capability inventory, exploratory review, and this change record. Existing domain
terms and provider-ownership decisions were sufficient, so no glossary or ADR change
was needed.
