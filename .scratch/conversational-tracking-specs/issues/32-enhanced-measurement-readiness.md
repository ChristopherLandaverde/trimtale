# Report enhanced-measurement readiness

Status: active

## Objective

Show whether the exact recognized GA4 web stream already covers GA4's automatic
enhanced-measurement interactions before proposing custom GTM work.

## Regression contract

### Read-only Analytics audit

- `apps/api/src/analytics.test.ts` maps one normalized measurement ID to exactly one
  accessible web stream and reads that stream's enhanced-measurement singleton.
- The result reports the master switch plus page changes, scrolls, outbound clicks,
  site search, video engagement, file downloads, and form interactions.
- Omitted protobuf booleans decode to their specified `false` default; non-boolean
  values fail closed.
- Disabled reads, zero or multiple stream matches, and denied provider access fail
  closed.
- The audit uses the existing `analytics.readonly` grant and never calls an update
  endpoint.

### Visible readiness

- `tests/e2e/gtm-connection-context.spec.ts` shows complete automatic coverage when all
  settings are enabled and names disabled capabilities when gaps exist.
- The audit runs only for one exact recognized destination with Analytics reads
  enabled. Otherwise the existing connection state remains honest.
- Malformed or failed audit responses show a bounded unavailable state and never raw
  provider content.

## Non-goals

- Do not enable or modify GA4 settings.
- Do not create GTM tags that duplicate enhanced measurement.
- Do not treat automatic `form_submit` as a confirmed `generate_lead` outcome.
- Do not add key events, custom definitions, or publication behavior.

## Done when

- The workbench identifies automatic coverage and gaps from one exact GA4 stream.
- Focused API and Chromium regressions pass.
- Full verification and exploratory Chromium review pass.

## Comments

- 2026-08-23: Claimed from the MVP requirement to cover GA4 enhanced measurement
  across static, SPA, and React sites without duplicating automatic events in GTM.
- 2026-08-23: Implemented the read-only Admin API audit, strict browser bridge, visible
  coverage summary, saved-session read gate, and permanent API plus Chromium
  regressions. A live ConsentFlow read found the master switch off with all seven
  feature toggles configured on. No setting or GTM resource was changed.
- 2026-08-23: Exploratory review found and resolved omitted ProtoJSON boolean decoding
  and unclear master-off copy. No unresolved finding remains.
- 2026-08-25: The element screenshot now fixes its test-only surface to the approved
  348px border-box width before capture. This removes a one-pixel parent-scrollbar
  toggle without changing the product or baseline; 20 repeated focused cases and the
  full 55-journey gate passed.
