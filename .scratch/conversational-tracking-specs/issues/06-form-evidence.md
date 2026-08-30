# Observe and normalize form run evidence

Status: resolved

Blocked by: 01, 04

## Objective

Capture safe evidence for form attempts, confirmed outcomes, data-layer events, GA4 requests, and consent state.

## Regression contract

Required test level: deterministic normalization, redaction, and local-store tests under `npm test`.

Behavioral test: `packages/core/src/form-evidence.test.ts`

Required invariants:

- Native, redirect, AJAX, and SPA observations normalize to one versioned evidence shape.
- Unobservable cases remain empty and inconclusive rather than becoming failures or passes.
- Form values, cookies, arbitrary page text, unsafe event fields, and unsafe request parameters are absent from serialized evidence.
- Evidence normalization accepts a verdict but never classifies it; issue 07 owns deterministic verdict rules.
- Tag firing is recorded as observed, not observed, or unknown; verdicts include one machine-readable next action for later conversational explanation.
- Stored local artifacts are isolated from caller mutation.

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

- 2026-08-22: Added transport-independent normalization into `TrackingRunEvidenceV1`, allowlisted data-layer and request fields, URL-query redaction, inconclusive unobservable evidence, and immutable local storage. Privacy sentinels prove values, cookies, page text, and unknown analytics fields do not persist. Verdicts remain supplied by the caller for issue 07 to classify.

## Answer

Form attempts, outcomes, matching data-layer events, GA4 requests, and consent now share one versioned, redacted evidence format across native, redirect, AJAX, and SPA transports. Unobservable inputs preserve an inconclusive result without fabricated observations, and local debugging artifacts cannot be mutated through returned references.
