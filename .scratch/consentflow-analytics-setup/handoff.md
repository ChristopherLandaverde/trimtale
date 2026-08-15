# ConsentFlow Analytics Setup Completion Handoff

## Completion state

The ConsentFlow navigation-tracking vertical slice is live and browser-verified as of 2026-08-15.

- GTM container: `ConsentFlow Verification` (`GTM-PCJ3Q5RK`)
- GTM resource path: `accounts/6305900974/containers/261236292`
- Live container version: `2`
- Version record: `ConsentFlow | GA4 navigation_click | 2026-08-15`
- Analytics property: `properties/550074997`
- Web data stream: `properties/550074997/dataStreams/15443100029`
- Measurement ID: `G-YV879ECLRV`
- Production website: `https://consentflow-psi.vercel.app`

Live version 2 initializes the web data stream with a Google tag on All Pages and sends `navigation_click` from the confirmed Features and Contact URL scope. The link trigger has Wait for Tags and Check Validation disabled and retains its exact URL filter.

## Production verification evidence

A Playwright-managed Chromium run against the production hostname observed:

1. `www.googletagmanager.com/gtm.js?id=GTM-PCJ3Q5RK`
2. `www.googletagmanager.com/gtag/js?id=G-YV879ECLRV`
3. A GA4 `page_view` request for `G-YV879ECLRV`
4. After clicking Features, a GA4 request with:
   - event: `navigation_click`
   - `link_text`: `Features`
   - `link_url`: `https://consentflow-psi.vercel.app/#features`

This is browser verification that the production page loaded GTM and transmitted the expected GA4 request. Confirming the event in GA4 Realtime or DebugView remains platform confirmation and is intentionally a separate evidence type.

The preserved production landing page currently exposes Features but does not expose a Contact navigation link. The published Contact URL remains configured but cannot be exercised until such a link exists on the page.

## Repository handoff

### GTM Observability

- Repository: `/home/oppie/projects/gtm-observability`
- Branch: `feature/google-gtm-integration`
- Publishing implementation commit: `2f77920 Add guarded GTM version publishing`
- Completion gate before publication: 42 unit/scenario tests plus the Chromium extension E2E

### ConsentFlow Debugger

- Repository: `/home/oppie/projects/ConsentFlow-Debugger`
- Branch: `feature/install-gtm-container`
- GTM installation commit: `baebbb1 Install GTM on ConsentFlow landing page`
- Production deployment: `dpl_FdUo3qnSWjKVdf9uaEgLfbgqy83U`
- Production deployment URL: `https://consentflow-eho99ydcv-christopherlandaverdes-projects.vercel.app`
- Production alias: `https://consentflow-psi.vercel.app`

The ConsentFlow repository had a pre-existing uncommitted `.gitignore` modification. It was deliberately excluded from the GTM installation commit and must be reviewed separately by its owner.

## Operational boundaries

- OAuth client credentials and persisted refresh tokens remain outside both repositories.
- Do not commit `.env*`, `.vercel/`, downloaded OAuth JSON, access tokens, or refresh tokens.
- The former verification-only Vercel preview remains evidence, not the production source.
- Roll back the website by reassigning the production alias to deployment `dpl_EP9tAN1s8vj4j62jG294iELMmCaE` if the GTM-enabled landing-page deployment must be reverted.
- Roll back GTM through a new reviewed container version; do not edit historical version 2.

## Suggested next session

Start from GA4 Realtime or DebugView to capture platform confirmation for `navigation_click`. After that, the next product slice can address repeatable browser verification and platform-confirmation evidence rather than adding more setup capabilities.
