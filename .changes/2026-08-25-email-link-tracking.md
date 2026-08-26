# Add privacy-safe email-link tracking

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/14-email-link-tracking.md`

## Summary

Add observable `mailto:` counting and privacy-safe `email_click` authoring to the
shared known-interaction workflow.

## Why

Email-link tracking is a common low-complexity agency request that can reuse the
existing scope, review, managed planning, and verification path without exposing
contact data or adding a separate workflow.

## Behavior

The website agent counts `mailto:` links, asks for sitewide or current-page scope, and
generates an `email_click` setup with analytics consent and no custom parameters. Email
addresses, `mailto:` URLs, subject/body values, and visible link text are excluded.
Pages without observable email links fail closed. Sent-message claims, conversion
claims, email fields, automatic coverage, CTA logic, SPA routes, and portal behavior
remain out of scope.

## Regression coverage

Core recipe, conversation, agent-turn, and acceptance tests cover event generation,
scope, local counts, privacy exclusions, observable-evidence requirements, and blocked
states. Two Chromium journeys cover setup through managed planning, no-evidence
behavior, and attacker-shaped address, subject, body, and visible text values.

## Verification

Focused core tests, all workspace typechecks, the production build, and both new
Chromium journeys pass. Final `npm run verify` passed 404 deterministic tests and 60
Chromium journeys; all builds, typechecks, preflight checks, and 67 change records
passed.

## Exploratory review

See `docs/reviews/2026-08-25-email-link-tracking.md`. Happy, no-evidence, and
attacker-shaped scenarios were inspected. No blocker or high-severity finding remains;
the long-review scroll-context finding is recorded separately for UI-polish work.

## Documentation

Added the `Email-link click` glossary term and updated the setup-engine specification,
active issue, current capabilities, Stage 1 handoff, exploratory review, and deferred
UI finding. No ADR was required because the feature extends the accepted shared
interaction workflow.
