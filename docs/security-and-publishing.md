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

## Google integration controls

`GET /api/google/status` is public and reports whether Google discovery is configured.

`GET /api/google/gtm/accounts` is admin-gated and must not be exposed with only a Google OAuth token. It requires:

- `GTM_OBSERVABILITY_ADMIN_TOKEN`: bearer token required from the caller
- `GOOGLE_OAUTH_ACCESS_TOKEN`: Google OAuth access token used server-side for read-only GTM discovery

Do not configure `GOOGLE_OAUTH_ACCESS_TOKEN` in production unless `GTM_OBSERVABILITY_ADMIN_TOKEN` is also set and known only to trusted operators.

## Extension host permissions

The extension manifest is generated at build time. It includes:

- the exact configured API origin from `GTM_OBSERVABILITY_API_BASE`
- the local fixture origin for deterministic development checks
- Google Analytics collection hosts used for browser evidence observation

Do not add wildcard Vercel host permissions. Build hosted extension artifacts with:

```bash
GTM_OBSERVABILITY_API_BASE=https://your-api.vercel.app npm run build:extension
```

For the current production API, build with:

```bash
npm run build:extension:prod
```

## Vercel pre-publish checklist

Before promoting a Vercel deployment to production:

- Run `npm run verify`.
- Typecheck the root Vercel API entrypoints.
- Verify `GET /api/health` on the deployment.
- Verify `GET /api/google/status` on the deployment.
- Verify `POST /api/setups` on the deployment with a disposable request.
- Confirm `.env*` and `.vercel` remain ignored and uncommitted.
- Confirm `GOOGLE_OAUTH_ACCESS_TOKEN` is absent unless an operator-only `GTM_OBSERVABILITY_ADMIN_TOKEN` is configured.
- Build any distributable extension artifact with the production API origin.

## Publishing boundary

Publishing means promoting the API deployment. It does not publish GTM changes, mutate a GTM container, or submit the Chrome extension to the Chrome Web Store.

The generated GTM file must still be imported by a tracking practitioner using Merge into a new GTM workspace, followed by GTM Preview and browser-side verification.
