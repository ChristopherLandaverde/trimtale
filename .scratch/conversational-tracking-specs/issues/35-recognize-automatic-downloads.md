# Recognize automatic download coverage

Delivery mode: specification
Status: active

## Problem

Typing `track downloads` currently produces the generic unknown-intent response even
when one exact GA4 stream already has automatic file-download measurement active.

## Proposed outcome

Recognize a download-tracking request and use the existing enhanced-measurement audit:

- Report `Already covered` when the master switch and file downloads are on.
- Offer browser verification of a real file link instead of generating duplicate GTM.
- Report the exact automatic-coverage gap when either setting is off.

## Non-goals

- Do not add a custom GTM download generator in this slice.
- Do not claim coverage without one exact recognized GA4 stream.
- Do not treat a link labelled “Download” as a file download without a supported file
  extension.
- Do not expand all enhanced-measurement intents from this one example.

## Decision needed

Authorize this narrow automatic-download workflow, or separately specify a custom GTM
fallback for sites that keep enhanced measurement off.

## Comments

- 2026-08-23: Live ConsentFlow proof produced an accepted `file_download` request for
  `G-YV879ECLRV`; the remaining gap is product recognition, not GA4 collection.
