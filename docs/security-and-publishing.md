# Security and Publishing Notes

Status: pre-production preview

## Current deployment shape

- The Chrome extension can run without a Google login.
- The public API endpoint `POST /api/setups` accepts confirmed navigation metadata and returns a GTM-compatible container file.
- The hosted API is deployed to Vercel as explicit functions under `api/`.
- The real Google Tag Manager discovery lane is present but gated separately from the no-login setup flow.

## Data boundaries

The no-login setup flow sends structured navigation metadata only:

- tracking intent
- page URL
- GA4 measurement ID entered by the practitioner
- GTM public container ID entered by the practitioner
- confirmed navigation link text, URL, area, and selector

It must not send full page HTML, cookies, local/session storage, form values, or arbitrary page text.

The extension stores the inferred or advanced-fallback GA4 Measurement ID and public GTM Container ID in `chrome.storage.local` by site hostname after a successful setup generation. These values are identifiers for repeat setup convenience; they must not be treated as GTM API credentials or proof of GTM account access.

The extension may read current-page DOM markup, script URLs, inline script text, iframe URLs, performance resource URLs, dataLayer entries, and runtime GTM globals to detect visible `GTM-` IDs and valid GA4 Measurement IDs. Only normalized IDs are returned to the workbench. This detection should be treated as page instrumentation evidence only.

During a lead-form verification, a MAIN-world page observer (`page-observer.js`) reads `window.dataLayer` entries without replacing `dataLayer.push`. It stays idle until a verification starts on the page. It forwards only event names, identifier-shaped `form_id`/`form_name` values and Consent Mode `analytics_storage` states to the isolated content script, which re-validates them. Form field values and other dataLayer fields never cross that boundary, and GA4 request URLs are reduced to an allowlist (`v`, `tid`, `en`, `ep.form_id`, `ep.form_name`, `ep.page_location`, `dl`, `gcs`, with query strings stripped from page URLs) before they are stored. The verdict's "Show evidence" list shows the first stored request as its host plus `tid`, `en`, `ep.form_id` and `ep.form_name` only (values capped at 80 characters, rendered as text); it never shows `dl`, `ep.page_location` or `gcs`. Navigation evidence keeps raw request URLs, so the presenter re-applies the same allowlist before showing them.

### Page-observer channel

Page scripts share the observer's world, so the channel between it and the extension is built so that a page cannot forge, start, read or disable it:

- The observer (`page-observer.js`, MAIN world) and a bridge (`page-bridge.js`, isolated world) both run at `document_start`, observer first. Chrome injects `document_start` scripts "before any other DOM is constructed or any other script is run" and injects static content scripts "in the order in which they are specified in the manifest" ([content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)).
- The bridge creates a `MessageChannel` and hands one port to the observer in a single synchronous `MessageEvent` on `document`; the observer takes it and removes its listener before any page script exists. Signals and the start command travel only over that port. No DOM event carries them, so a page cannot dispatch fake signals, start polling, or listen to the stream, and a later handshake attempt finds no listener.
- The observer captures the built-ins on that path (`EventTarget` listeners, `MessagePort`, `setInterval`, `Date.now`, `Reflect.apply`) before page scripts can replace them. It sends structured-cloned objects, not JSON, so a rewritten `JSON.stringify` or `toJSON` has no effect. It keeps its state in a closure; there is no global flag a page could pre-set.
- The bridge rebuilds every signal from allowlisted fields with the isolated world's own built-ins (`pageSignalFromValue`).
- Submit and `invalid` events start or fail a run only when `isTrusted`; a page script's synthetic events are ignored.

What a page still controls, by definition:

- **Its own `dataLayer`.** The observer reports what the page pushed. A page can push a `generate_lead` it never acted on, or a consent command GTM ignores, and the observer reports it, the same as before. A page that rewrites built-ins the sanitizer uses can make the observer report dataLayer content that is not there, which gains nothing over pushing it. A page can also tell that something is reading `window.dataLayer` (a getter on `window.dataLayer` sees the polling).
- **Its DOM and URL.** The success element and thank-you URL are page state.

How verdicts weigh that evidence: dataLayer signals alone can never produce `browser_verified`. A passing verdict also needs exactly one GA4 `/g/collect` request for the specified event, with `form_id`, `form_name` and a page location, seen by the service worker through `chrome.webRequest` and not reported failed. A page cannot fabricate that observation without the browser actually sending the request; a page that sends a hand-made GA4 request is really sending a hit to Google, which is why platform confirmation stays `unverified` until GA4 reports it. What dataLayer-only evidence can change is which failure or inconclusive verdict a broken setup gets (for example `outcome_observed_event_missing` versus `datalayer_event_observed_tag_not_firing`), and a page-reported denied consent state takes precedence over the `gcs` parameter, giving `consent_limited` (inconclusive, never passed).

The same principle decides a form's submission result: what the browser saw the form endpoint
answer outranks what the page reports about itself. A 5xx or 400/422 from the form endpoint (a
fetch/XHR to the form's action origin, or the document a native POST returned) beats the
success element, the thank-you URL and the dataLayer event, so a page that shows success after
a failed request gets `submission_failed` or `expected_non_conversion`, never a pass. The
conflicting success signal stays in the evidence and the next action names it with the HTTP
status. A failure from another origin (an analytics or chat widget) is not attributed to the
form and only counts when the page showed no success. The full order is documented in
`docs/product-plan/current-capabilities.md` and on `FormRun` in
`packages/core/src/form-signals.ts`.

## Google integration controls

`GET /api/google/status` is public and reports whether Google discovery is configured.

`GET /api/google/gtm/accounts` is admin-gated and must not be exposed with only a Google OAuth token. It requires:

- `GTM_OBSERVABILITY_ADMIN_TOKEN`: bearer token required from the caller
- `GOOGLE_OAUTH_ACCESS_TOKEN`: Google OAuth access token used server-side for read-only GTM discovery

Do not configure `GOOGLE_OAUTH_ACCESS_TOKEN` in production unless `GTM_OBSERVABILITY_ADMIN_TOKEN` is also set and known only to trusted operators.

`POST /api/google/gtm/resolve-site` is the narrower extension-facing read path. It accepts the page URL and page-detected GTM/GA4 signals, matches a visible public GTM ID to an accessible container, reads that container's live published version, and returns valid GA4 Measurement IDs found in the container configuration. It requires `GOOGLE_OAUTH_ACCESS_TOKEN` plus either `GTM_OBSERVABILITY_ADMIN_TOKEN` or `GTM_OBSERVABILITY_EXTENSION_TOKEN`.

`GTM_OBSERVABILITY_EXTENSION_TOKEN` may be bundled into an unpacked extension build for internal testing. Treat it as a temporary bridge, not a long-term end-user authentication model. A production multi-user version should replace that token with user-scoped OAuth/session authorization so users can resolve only the GTM containers they are allowed to access.

## Extension host permissions

The extension manifest is generated at build time. It includes:

- the exact configured API origin from `GTM_OBSERVABILITY_API_BASE`
- the local fixture origin for deterministic development checks
- Google Analytics collection hosts used for browser evidence observation

The extension requests the `downloads` permission only to save the generated GTM container JSON and browser-verification evidence report from the embedded workbench.

Do not add wildcard Vercel host permissions. Build hosted extension artifacts with:

```bash
GTM_OBSERVABILITY_API_BASE=https://your-api.vercel.app npm run build:extension
```

For the current production API, build with:

```bash
npm run build:extension:prod
```

Load `apps/extension/prod-dist` in Chrome for production-style testing. The local deterministic harness uses `apps/extension/dist`, so `prod-dist` remains stable when `npm run verify` rebuilds local artifacts.

## Vercel pre-publish checklist

Before promoting a Vercel deployment to production:

- Run `npm run verify`.
- Typecheck the root Vercel API entrypoints.
- Verify `GET /api/health` on the deployment.
- Verify `GET /api/google/status` on the deployment.
- Verify `POST /api/setups` on the deployment with a disposable request.
- Confirm `.env*` and `.vercel` remain ignored and uncommitted.
- Confirm `GOOGLE_OAUTH_ACCESS_TOKEN` is absent unless an operator-only `GTM_OBSERVABILITY_ADMIN_TOKEN` is configured.
- If enabling extension-based GTM resolution, configure `GTM_OBSERVABILITY_EXTENSION_TOKEN` on the API and build the extension with the same value.
- Build any distributable extension artifact with the production API origin.

## Publishing boundary

Publishing means promoting the API deployment. It does not publish GTM changes, mutate a GTM container, or submit the Chrome extension to the Chrome Web Store.

The generated GTM file must still be imported by a tracking practitioner using Merge into a new GTM workspace, followed by GTM Preview and browser-side verification.
