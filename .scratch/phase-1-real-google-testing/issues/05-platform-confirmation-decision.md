# Decide platform confirmation evidence source

Status: resolved

## Problem

Platform confirmation cannot be inferred from the extension or network request. A
separate destination-side evidence source is required before the product can claim
GA4, Ads, or other platform receipt.

## Regression Contract

- Compare candidate platform evidence sources and their permissions, latency, quota,
  privacy, and failure modes.
- Decide whether Phase 1 stays browser-only or adds a separate later integration.
- Do not change UI language until the decision is accepted.

## Acceptance Criteria

- [x] Decision records at least GA4 DebugView, GA4 reporting/Data API, BigQuery
      export, and Ads diagnostics as candidates or non-candidates.
- [x] Decision names the accepted product language.
- [x] Existing browser-verification language remains unchanged unless a new
      destination-side signal is implemented.

## Resolution Notes

- Added `docs/engineering/platform-confirmation-decision.md`.
- Phase 1 remains browser-verification only; destination-side platform confirmation
  is deferred to a separate future feature.
