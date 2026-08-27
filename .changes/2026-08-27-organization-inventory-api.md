# Add the organization inventory API

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/38-organization-inventory-api.md`

## Summary

Added an authenticated read-only API that captures one organization's GTM web-
container inventory, persists its latest baseline, and reports newly observed exact
differences.

## Why

The core inventory schema, comparator, and Google capture client existed separately,
but no product boundary composed them into the trusted read model required by the
future portal.

## Behavior

`GET /api/google/inventory` requires organization tracking-read permission. Its first
capture establishes one private baseline per organization and Google connection. Each
later capture reports exact container, live-version, workspace, access, and GA4-context
changes and atomically replaces the baseline. Every change remains explicitly
`impactAssessment: not_assessed`.

The route requests no new Google scope, labels effective ACL access unavailable, and
adds no tag-authoring, provider mutation, scheduling, alerting, retention history, or
visual portal surface.

## Regression coverage

`apps/api/src/container-inventory-api.test.ts` protects baseline creation, exact
comparison, organization and connection isolation, clone safety, 0600 atomic
persistence, stale-capture rejection, corrupted storage, and invalid provider output.
Existing Google inventory, core comparison, and organization-auth tests remain green.

## Verification

- Failing-first focused API suite: reproduced the missing module.
- Focused API, Google, organization-auth, and core inventory suites: 33 tests passed.
- Final `npm run verify`: 469 deterministic tests and 87 Chromium end-to-end journeys
  passed.

## Exploratory review

Interactive review is not applicable to this non-visual read-model slice. The future
portal UI will receive complete Chromium happy, negative, and adversarial review. This
API's positive and fail-closed boundaries run in the deterministic harness.

## Documentation

Updated the setup-engine implementation backlog, Issue 08, Issue 38, and current
capabilities. No domain term or architectural decision changed.
