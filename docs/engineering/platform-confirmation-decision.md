# Platform Confirmation Decision

Status: accepted for Phase 1

## Decision

Phase 1 remains browser-verification only. The product must not claim GA4, Google
Ads, reporting, attribution, or downstream platform confirmation from extension
network evidence.

The accepted Phase 1 language is:

- `Google request verified`
- `Browser verification passed`
- `Platform confirmation unavailable`

The product may consider destination-side confirmation later, but only as a separate
feature with its own credentials, latency model, privacy review, UI language, and
regression harness.

## Candidate Evidence Sources

### GA4 DebugView

Google positions DebugView as a real-time troubleshooting surface for events from a
debug-enabled device. It is useful for human validation, but it is not a stable Phase
1 automation contract because it requires debug-mode setup, UI/session context, and
does not represent ordinary reporting availability.

Source: [Verify and troubleshoot your Google Analytics setup](https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot), [Monitor events in DebugView](https://support.google.com/analytics/answer/7201382)

### GA4 Realtime and Data API

Realtime can show events within minutes, and the Data API can query Analytics report
data. These are reporting/data surfaces, not browser-delivery evidence. They require
Analytics property access and introduce reporting identity, freshness, thresholding,
and query-shape concerns that need a separate integration design.

Source: [Google Analytics Data API overview](https://developers.google.com/analytics/devguides/reporting/data/v1), [GA4 Data freshness](https://support.google.com/analytics/answer/11198161)

### GA4 BigQuery Export

BigQuery export can provide event-level data for linked properties. Daily export is
not immediate, and streaming export is best-effort with cost and completeness caveats.
It is a plausible later evidence source for disposable-resource validation, but it is
too heavy and delayed to be Phase 1 inline confirmation.

Source: [GA4 BigQuery Export](https://support.google.com/analytics/answer/9358801), [GA4 BigQuery Export schema](https://support.google.com/analytics/answer/7029846)

### Google Ads Diagnostics

Google Ads conversion diagnostics can help troubleshoot conversion integrations, but
Ads attribution and diagnostics are a different product boundary from GA4 collection.
They should not be collapsed into GTM/GA4 browser verification.

Source: [Google Ads API conversion troubleshooting](https://developers.google.com/google-ads/api/docs/conversions/troubleshooting)

## Consequences

- Phase 1 can proceed to real disposable GTM testing without waiting for platform
  confirmation.
- Browser evidence remains enough to complete the current product goal.
- Platform confirmation remains a later product lane, not a hidden requirement for
  the current workflow.
- Any future platform-confirmation feature must add new tests proving the UI does not
  confuse browser delivery with destination receipt.
