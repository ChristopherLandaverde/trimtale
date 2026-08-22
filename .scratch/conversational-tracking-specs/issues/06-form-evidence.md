# Observe and normalize form run evidence

Status: open

Blocked by: 01, 04

## Objective

Capture safe evidence for form attempts, confirmed outcomes, data-layer events, GA4 requests, and consent state.

## Work

- Observe native, redirect, AJAX, and SPA success patterns supported by the spec.
- Normalize observations into `TrackingRunEvidenceV1`.
- Redact or omit field values and personal information at collection boundaries.
- Persist artifacts locally for test and debugging use.

## Done when

- All supported transports produce comparable evidence.
- Cross-origin or otherwise unobservable cases are marked insufficient rather than failed.
- Privacy tests prove that submitted values are absent from messages and artifacts.
- `npm run verify` passes.

## Comments
