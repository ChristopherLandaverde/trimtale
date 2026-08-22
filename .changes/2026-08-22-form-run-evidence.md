# Normalize safe form run evidence

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/06-form-evidence.md`

## Summary

Added a versioned form-observation normalization boundary with explicit privacy filtering and immutable local evidence storage.

## Why

Browser transports produce different raw signals, but diagnosis requires comparable evidence that cannot retain submitted values, cookies, arbitrary page text, or unsafe analytics parameters.

## Behavior

Native, redirect, AJAX, SPA, and unobservable inputs normalize to `TrackingRunEvidenceV1`, including tri-state tag-firing evidence (`true`, `false`, or unknown) and a structured next action. Only allowlisted event metadata and GA4 request parameters survive. Page-location queries, unknown event fields, unrelated endpoints, and caller-only data are omitted. Classification remains a separate supplied input for issue 07.

## Regression coverage

`packages/core/src/form-evidence.test.ts` covers four supported transports, insufficient evidence, privacy sentinels, request sanitization, normalization, and immutable storage. Existing sixteen-scenario browser replays continue protecting raw fixture behavior.

## Verification

`npm run verify` passed with valid change documentation, strict type checks, 59 deterministic tests, all workspace builds, and 20 Chromium workflows.

## Exploratory review

No separate exploratory Chromium review is applicable because this slice adds an internal evidence boundary with no new visible product state. Existing Chromium fixtures cover the transport and signal sources consumed by this normalizer.

## Documentation

Issue 06 now records the evidence/verdict ownership boundary and permanent privacy contract.
