# Recognize automatic coverage intents

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/13-automatic-coverage-intents.md`

## Summary

Recognize page-view, scroll, site-search, and video-engagement requests and report
their exact GA4 stream's Enhanced Measurement coverage without generating GTM setup.

## Why

Practitioners can resolve common automatic-measurement questions immediately while
avoiding duplicate tags and keeping portal work deferred.

## Behavior

The website agent classifies four coverage-only intents. With one exact stream and
valid settings, it reports that the feature is covered or names the feature or master
switch gap. Without authoritative settings, it requests the exact context and fails
closed. No setup, mutation, review, approval, or download action is offered. Browser
interaction exercises, GA4 writes, fallback tags, email links, CTA selection, and
portal behavior remain out of scope.

## Regression coverage

Core conversation and agent-turn tests cover precise classification, covered states,
feature-off, master-off, unavailable settings, no actions, and coverage-specific plan
labels. The acceptance corpus records all four intents. Three Chromium journeys cover
visible covered, gap, and unavailable states plus attacker-shaped page content.

## Verification

Focused core tests, all workspace typechecks, the production build, and all three new
Chromium journeys pass. Final `npm run verify` passed 399 deterministic tests and 58
Chromium journeys; all builds, typechecks, preflight checks, and 66 change records
passed.

## Exploratory review

See `docs/reviews/2026-08-25-automatic-coverage-intents.md`. Covered, gap, unavailable,
and attacker-shaped scenarios were inspected. No blocker or high-severity finding
remains; one misleading inherited plan label was corrected and permanently covered.

## Documentation

Updated the setup-engine specification, active implementation issue, current
capabilities, Stage 1 handoff, and exploratory-review record. The existing
`Enhanced-measurement coverage` glossary term was reused, so no new domain term or ADR
was required.
