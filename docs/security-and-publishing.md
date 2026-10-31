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

Google access runs only through the local API (`npm run dev:api`, `apps/api/src/server.ts`),
which listens on `127.0.0.1`. The hosted Vercel functions route through
`apps/api/src/app.ts`, which serves `GET /api/health` and `POST /api/setups` only; the
`api/google/` function files return 404.

The local API enables Google routes only when all three OAuth settings are present:

- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`

Without them, `GET /api/google/status` reports `configured: false` and the other Google
routes refuse. With them, the practitioner connects through `GET /api/google/oauth/start` and
the callback, which checks a single-use random `state`. Access is read-only
(`tagmanager.readonly`) unless the operator opts in:

- `GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true` requests the container-edit scope, so Trimtale
  can prepare its managed workspace.
- `GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true` and `GOOGLE_GTM_PUBLICATION_ENABLED=true`,
  together with container writes, are all required before anything can be published. All
  three are off by default.
- `GOOGLE_OAUTH_TOKEN_STORE` optionally persists tokens to a local file. Operation records go
  to `.data/`, which is git-ignored.

Even with publication enabled, publishing a version takes two separate requests: approve,
then publish. Approval needs the container's public ID typed back, records the connected
Google account's verified email as the approver, and expires after 30 minutes.

Rolling back to the prior live version follows the same rule (`/rollback-approval`, then
`/rollback`), behind the same publication switch: the container's public ID typed back, the
verified email recorded as the rollback approver, a 30-minute approval, and the same account
at rollback time. An approver sent by the client is ignored on every route.

Google and intake-evaluation routes answer cross-origin requests only from the origin in
`EXTENSION_ORIGIN` (`apps/api/src/cors.ts`); a missing, `*` or `null` value refuses them. The
local server and the Vercel functions (`apps/api/src/vercel.ts`) apply the same rule. Public
routes (`/api/health`, `/api/setups`) stay open to any origin because they are stateless.

## Extension permissions

The extension requests `activeTab`, `scripting`, `storage` and `webRequest`. Its content
scripts load on every `http` and `https` page. On each page they add the collapsed assistant
panel and resume a form check left in progress. If the panel was left open, they also send
the page's detected GTM container IDs to the local API (`127.0.0.1:18787`) to recognise the
matching container. The page observer stays idle until a check starts on the page. Its host
permissions are the configured API origin from `GTM_OBSERVABILITY_API_BASE`, the local
fixture origin for deterministic checks, and the Google Analytics collection hosts it
observes for browser evidence. Generated files are saved through a download link in the panel, so
the extension does not need the `downloads` permission.

Do not add wildcard Vercel host permissions. Build hosted extension artifacts with:

```bash
GTM_OBSERVABILITY_API_BASE=https://your-api.vercel.app npm run build:extension
```

The extension bundle carries no secrets: the only build-time value compiled into it is
`GTM_OBSERVABILITY_API_BASE`. Anything compiled into an extension can be read by whoever
installs it, so never add a credential to the build.

Load `apps/extension/prod-dist` for production-style testing (`npm run build:extension:prod`).
The local deterministic harness uses `apps/extension/dist`, so `prod-dist` stays stable when
`npm run verify` rebuilds local artifacts.

## Vercel pre-publish checklist

Before promoting a Vercel deployment to production:

- Run `npm run verify`.
- Typecheck the root Vercel API entrypoints.
- Verify `GET /api/health` and `POST /api/setups` on the deployment with a disposable request.
- Confirm `.env*.local`, `.vercel` and `.data/` remain ignored and uncommitted.
- Build any distributable extension artifact with the production API origin.
- Set `EXTENSION_ORIGIN` to the published extension's exact `chrome-extension://<id>` origin
  before any Google or intake route is served from Vercel; unset, `*` or `null` refuses them.

## Publishing boundary

"Publishing the API" means promoting a Vercel deployment. It does not change a GTM container
or submit the extension to the Chrome Web Store.

Publishing a GTM container version is a separate, local-API-only path, disabled by default
and gated as described under Google integration controls. With it disabled, the generated
GTM file must be imported by a practitioner using Merge into a new GTM workspace, followed by
GTM Preview and browser-side verification.
