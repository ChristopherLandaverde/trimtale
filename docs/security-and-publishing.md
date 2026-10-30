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

During a lead-form verification, a MAIN-world page observer (`page-observer.js`) reads `window.dataLayer` entries without replacing `dataLayer.push`. It stays idle until a verification starts on the page. It forwards only event names, identifier-shaped `form_id`/`form_name` values and Consent Mode `analytics_storage` states to the isolated content script, which re-validates them. Form field values and other dataLayer fields never cross that boundary, and GA4 request URLs are reduced to an allowlist (`v`, `tid`, `en`, `ep.form_id`, `ep.form_name`, `ep.page_location`, `dl`, `gcs`, with query strings stripped from page URLs) before they are stored.

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
