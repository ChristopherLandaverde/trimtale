# Add low-effort link interactions

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/12-low-effort-link-interactions.md`

## Summary

Add privacy-safe outbound-link and file-download tracking to the shared website-agent
interaction workflow, while preferring exact-stream GA4 automatic coverage when it is
already enabled.

## Why

These common tracking requests can reuse the current setup engine and shorten routine
agency work without adding event-specific workflow branches or returning to portal
development.

## Behavior

The agent locally counts eligible outbound and supported downloadable-file links,
grounds scope in that evidence, and offers `outbound_click` or `file_download` setup
when the exact GA4 stream does not already cover the interaction. When Enhanced
Measurement is active for the requested feature, it reports existing coverage and
does not generate a duplicate GTM setup. Destination URLs, query strings, link text,
and file names are excluded from custom event parameters. CTA buttons, email links,
SPA routes, element visibility, and Custom HTML remain unchanged and out of scope.

## Regression coverage

Core tests cover classification, bounded local counts, same-origin exclusion,
case-insensitive file extensions, page-only scope, consent, parameter exclusions,
verification expectations, and automatic-coverage decisions. Three Chromium journeys
cover outbound setup and managed planning, download setup, automatic-coverage
deduplication, and attacker-shaped destinations.

## Verification

Focused core tests, all workspace typechecks, all 392 unit tests, the three new
Chromium journeys, and the existing automatic-download journey pass. After resolving
the unrelated visual-contract instability, final `npm run verify` passed all checks,
392 deterministic tests, every build, and all 55 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-25-low-effort-link-interactions.md` for happy, negative, and
attacker-shaped scenarios and any unresolved findings.

## Documentation

Updated the root domain glossary, setup-engine specification, current capabilities,
Stage 1 handoff, implementation issue, and exploratory review.
