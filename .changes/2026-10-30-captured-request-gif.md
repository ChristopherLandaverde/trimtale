# Show the captured GA4 request in verdict evidence, and a README GIF

Change record version: 2

Issue: none; owner request (README needs a recording of the extension capturing the form's GA4 request).

## Summary

The verdict's "Show evidence" list now shows the first captured GA4 request by host and
allowlisted parameters (`tid`, `en`, `ep.form_id`, `ep.form_name`), labelled
`network.ga4Requests[0].*`, next to the existing request count. The README hero is now a GIF of a
lead form verified on the bundled fixture site, recorded by `scripts/record-readme-gif.mjs`.

## Why

A request count says something was sent; the host, measurement ID, event name and form ID show
what was sent, which is the evidence a practitioner compares against their GTM tag. The README
needed to show the browser actually collecting the tag.

## Behavior

- New: rows `network.ga4Requests[0].host|tid|en|ep.form_id|ep.form_name` after `network.ga4Requests`
  when at least one request exists. Absent parameters get no row. Only the first request is shown.
- The presenter re-runs core `safeRequestUrl` on the URL (navigation evidence stores raw URLs), so a
  malformed, non-collection or off-host URL yields no rows and no error. `dl`, `ep.page_location`,
  `gcs` and anything off the allowlist are never shown; values are capped at 80 characters.
- Evidence label column capped at 55% instead of 62% so values such as `browser_verified` no longer
  wrap mid-word next to the longer labels.
- Unchanged: verdicts, finding copy, stored evidence, the count row.
- `scripts/record-readme-gif.mjs` is a manual maintenance script; it is not run by `npm run verify`
  or CI. It uses only the local API and fixture site, and seeds the remembered panel size
  (420×690) in extension storage, the same state a manual resize leaves.

## Regression coverage

- `apps/extension/src/verdict-presenter.test.ts` "captured request rows": order and values, no
  page URLs/consent/off-allowlist params, first request only, fixture host, omitted parameters,
  malformed/non-collection host/path skipped, no rows at zero requests, bounded hostile values,
  re-sanitized navigation URLs.
- `tests/e2e/conversational-form.spec.ts`: the verified journey asserts the host, `tid`, `en` and
  `ep.form_id` rows in the built extension; both journeys assert no `page_location` and no typed
  email in the evidence list.
- No visual baseline changed: no screenshot baseline shows an expanded evidence list.

## Verification

`npm run verify` (see PR body for output).

## Exploratory review

[docs/reviews/2026-10-30-captured-request-evidence.md](../docs/reviews/2026-10-30-captured-request-evidence.md):
happy (`ajax_success`), negative (`validation_failure`, `missing_required_parameter`), ambiguous
(`duplicate_request`) and an adversarial page rewriting its own beacon with hostile and
off-allowlist values. One low finding fixed (label column width); no blocker or high findings.

## Documentation

- README: GIF hero with alt text and caption naming the fixture site and local collection endpoint;
  the GTM-connection screenshot moved below "What it does".
- `docs/security-and-publishing.md`: what the evidence list displays from a stored request.
