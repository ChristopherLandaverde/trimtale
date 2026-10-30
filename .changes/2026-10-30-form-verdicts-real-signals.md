# Form verdicts from real browser signals

Change record version: 2

Issue: Slice 1 in `portfolio-ops/audits/gtm-observability-state.md` (gap G1/G2); Christopher's 2026-10-30 decision that Stage 1 is detect + verify.

## Summary

The lead-form verdict no longer reads `document.documentElement.dataset` flags that only the
fixture site set. It is built from real browser signals: submit and `invalid` events, the
confirmed success signal (visible element, thank-you URL including after a full redirect, or
dataLayer event), `aria-invalid` and form-endpoint HTTP status, a MAIN-world dataLayer
observer, Consent Mode commands and `gcs`, and GA4 request attempts with their delivery result.

## Why

On a real site every verdict input except the GA4 request was missing, so verdicts fell back to
"insufficient evidence". Detect + verify is Stage 1, so the verify half has to work off the
fixture.

## Behavior

- New core module `form-signals.ts` (`FormRun`, signal parsing, consent from `gcs`, response
  classification, thank-you URL patterns) and `page-signals.ts` (dataLayer sanitizer, also
  bundled into the page observer).
- New MAIN-world content script `page-observer.js` that polls `window.dataLayer` without
  replacing `push`, stays idle until a verification starts, and emits only event names,
  identifier-shaped form IDs/names and consent states.
- The service worker tracks GA4 request delivery (`onCompleted`/`onErrorOccurred`) and keeps a
  form run in `chrome.storage.session` for 30s so a thank-you redirect can finish the run on the
  next page. The assistant reopens there and says so.
- Only GA4 requests whose `en` matches the specification's event count toward the verdict, so
  `page_view` and other events no longer count as duplicates.
- Success discovery drops the fixture-only `data-success-selector`/`data-success-url` hints and
  adds a thank-you page from a same-origin form `action`.
- The fixture site sets no verdict flags. It now behaves like a real site (fetch/XHR to
  `/api/lead`, a stand-in GTM tag, Consent Mode commands, a dropped GA4 connection, native POST
  to `/thank-you`) and adds `html5_validation_failure` and `embedded_form` scenarios (18 total).
- Unchanged: the verdict engine and its codes; the fixture `<meta>` GTM/GA4 ID hints used for
  setup generation (not verdict inputs); verdict message copy.
- Out of scope: GA4 events batched in a POST body, non-GA4 destinations, cross-origin iframes.

## Regression coverage

- `packages/core/src/form-signals.test.ts` (21 tests): every verdict path from signals,
  serialization across navigation, consent from commands and `gcs`, and no form value in
  signals, serialized runs or evidence.
- `apps/extension/src/evidence-capture.test.ts`: rewritten for `FormRun` input.
- `tests/e2e/form-real-signals.spec.ts` (19 tests): the 17 form-bearing fixture scenarios get
  the correct verdict in Chromium with no `data-*` on `<html>`; the sentinel email never
  appears in page signals, API traffic or the assistant; the iframe case shows no verdict;
  the observer is idle until verification and strips values.
- `tests/e2e/form-fixtures.spec.ts`: replays each scenario's real page behavior instead of
  asserting the removed flags (a deliberate replacement of those assertions).

## Verification

`npm run check` passed; `npx vitest run` 41 files / 322 tests passed; `npm run build` passed;
`npx playwright test` 67 passed on macOS. Visual baselines unchanged.

## Exploratory review

`docs/reviews/2026-10-30-form-real-signals.md`: happy (AJAX, thank-you redirect, embedded
form), negative (server 500, HTML5 validation), ambiguous (consent denied), adversarial (email
in dataLayer). No blocker or high findings.

## Documentation

README (known limits, privacy, capability row), `docs/product-plan/current-capabilities.md`
(signal table), `docs/security-and-publishing.md` (page observer boundary).
