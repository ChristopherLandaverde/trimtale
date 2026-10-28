# Enable enhanced measurement safely

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/34-enable-enhanced-measurement.md`

## Summary

Added a separately gated, reviewed action that enables only one exact GA4 stream's
enhanced-measurement master switch.

## Why

A setup audit that can only report a disabled prerequisite leaves the MVP workflow
unable to complete automatic measurement setup.

## Behavior

- Analytics edit consent and runtime writes are off by default.
- Review names the measurement ID, property, stream, and exact change.
- Confirmation fresh-reads the destination and patches only `stream_enabled`.
- Cancellation, malformed results, and already-enabled streams produce no blind write.
- Individual feature toggles, GTM changes, publication, and live ConsentFlow execution
  remain out of scope.

## Regression coverage

`apps/api/src/analytics.test.ts` covers the write gate, exact destination, update mask,
and no-op. `apps/api/src/google.test.ts` covers separate edit consent.
`tests/e2e/gtm-connection-context.spec.ts` covers review, cancellation, malformed data,
retry, success, and attacker-shaped input.

## Verification

`npm run verify` passed all checks, 287 deterministic tests, and 50 Chromium journeys.
The focused connection suite also passed 13 journeys.

## Exploratory review

[Enablement review](../docs/reviews/2026-08-23-enhanced-measurement-enablement.md)
covered the happy, cancelled, malformed, and adversarial paths. One layout finding was
resolved; none remains.

## Documentation

Updated the accepted specification, issue 34, README, operator runbook, and exploratory
review.
