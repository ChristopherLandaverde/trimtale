# Add organization-scoped container inventory state

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/08-portal-inventory.md`

## Summary

Add organization-scoped GTM web-container snapshots, provider-state capture, and exact
configuration-change comparison.

## Why

The future control portal needs consistent account, container, workspace, live-version,
GA4-context, and change history without becoming a tag editor or scanner.

## Behavior

Inventory capture excludes non-web containers, binds snapshots to one organization and
Google connection, and marks ACL evidence unavailable unless separately verified.
Comparison reports added, removed, and changed provider configuration while keeping
website impact explicitly unassessed.

## Regression coverage

`packages/core/src/container-inventory.test.ts` and `apps/api/src/google.test.ts`
cover organization isolation, web filtering, unavailable ACL evidence, exact provider
fingerprints, and change classification.

## Verification

`npm run verify` passes 369 unit tests and 51 Playwright Chromium journeys.

## Exploratory review

Not yet applicable. The signed-in portal UI and identity provider remain open choices.

## Documentation

Issue 08 records that exact GTM ACL enumeration requires a separate Google user-
management permission decision.
