# Report enhanced-measurement readiness

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/32-enhanced-measurement-readiness.md`

## Summary

Added a read-only GA4 enhanced-measurement audit to the recognized connection card.
It reports effective automatic coverage before custom GTM work begins.

## Why

The MVP must distinguish GA4 capabilities already covered automatically from custom
tracking work that still needs GTM.

## Behavior

- One exact measurement ID maps to one accessible web stream and reads its enhanced-
  measurement singleton through the existing `analytics.readonly` grant.
- The card reports all seven automatic feature settings, the master switch, and named
  coverage gaps. Malformed or unavailable responses remain bounded.
- The saved Google launcher enables Analytics reads and keeps publication off.
- No GA4 setting, GTM resource, key event, custom definition, or publication behavior
  was added.

## Regression coverage

`apps/api/src/analytics.test.ts` covers exact reads, ProtoJSON defaults, malformed
values, disabled access, ambiguity, and provider denial. `scripts/google-session.test.ts`
protects the saved read gate. `tests/e2e/gtm-connection-context.spec.ts` covers complete,
partial, master-off, malformed, offline, inaccessible, and ambiguous visible states.
`tests/e2e/connected-verification-evidence.spec.ts` keeps the complete lead journey
deterministic with the new audit.

## Verification

- Focused API and launcher tests passed 11 cases.
- Focused connection-card tests passed 12 Chromium journeys.
- A live read found ConsentFlow's master switch off and all seven feature toggles on;
  no write was made.
- `npm run verify` passed 281 deterministic tests and 49 Chromium journeys.

## Exploratory review

[Enhanced-measurement readiness review](../docs/reviews/2026-08-23-enhanced-measurement-readiness.md)
covered complete, partial, master-off, malformed, and live read-only states. Two
findings were corrected; none remains.

## Documentation

The accepted specification, current-capabilities plan, repeat-session README, issue
32, and exploratory review record the readiness behavior and non-goals.
