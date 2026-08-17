# GTM Observability

An intelligent creation, testing, and observability layer for Google Tag Manager.

This project does not replace GTM. GTM remains the configuration, execution, versioning, environment, and publishing layer. This product connects GTM configuration evidence with browser-runtime evidence so teams can detect broken tracking, understand why it broke, test corrections, and deploy verified GTM changes.

## Product promise

Describe what should be tracked. The system tests the real user journey, explains failures, generates a GTM draft, and continuously verifies that tracking still works.

## Core workflow

```text
Connect GTM
    -> Audit configuration
    -> Observe dataLayer and network behavior
    -> Record or generate Playwright journeys
    -> Monitor continuously
    -> Diagnose incidents
    -> Generate and test corrections
    -> Create a reviewable GTM workspace
    -> Deploy with human approval
```

## GTM API responsibilities

- Read accounts, containers, workspaces, versions, tags, triggers, and variables.
- Audit the live container and compare versions.
- Create isolated workspaces and apply changes.
- Check synchronization and compiler errors.
- Create container versions and target environments.
- Publish only with an explicit approval workflow.

## Product-owned responsibilities

- Capture data-layer events and property schemas.
- Observe analytics network requests.
- Run synthetic user journeys with Playwright.
- Decode and validate destination payloads.
- Monitor schema drift, missing events, and duplicate delivery.
- Correlate runtime failures with GTM configuration changes.
- Explain incidents and verify proposed corrections.

## Initial MVP

1. Browser-based Tracking Check without requiring GTM access.
2. Read-only GTM connection and container audit.
3. Scheduled Playwright journey monitoring.
4. Evidence-backed incident diagnosis.
5. Verified GTM workspace creation without automatic production publishing.

## Mockups

The `mockups/` directory contains the observability overview, container audit, live debugger, automated test, scheduled journeys, incident diagnosis, and GTM change-review screens.

## Product plan

The `docs/product-plan/` directory describes the staged path from the navigation-tracking MVP to a full GTM and GA4 observability product, including architecture, agent design, weekly scans, and go-to-market timing.

## Navigation tracking MVP

The first implemented vertical slice is a Chrome extension plus a small local backend:

```text
Discover navigation
    -> confirm scope
    -> generate a partial GTM container file
    -> import with Merge into a new workspace
    -> connect GTM Preview
    -> perform guided browser verification
```

The implementation deliberately distinguishes browser verification from GA4 platform confirmation. See [the feature specification](.scratch/navigation-tracking/spec.md) for the supported path and exclusions.

The Chrome extension action opens the workbench as an overlay on the current site so practitioners can stay on the page they are configuring.

### Development

Requirements: Node.js 22+ and npm 10+.

```bash
npm install
npm run verify
```

The local harness uses `http://127.0.0.1:18787` for the API and `http://127.0.0.1:14173` for the fixture site.

`npm run verify` is the agent-owned completion gate. It:

- Runs strict TypeScript checks.
- Runs the deterministic scenario corpus.
- Builds the backend, fixture site, shared package, and extension.
- Starts the local services.
- Launches Playwright's managed Chromium with the extension preloaded.
- Exercises discovery, generation, download validation, and guided browser verification.
- Validates the browser-verification evidence report download.
- Saves Playwright traces and failure evidence under `test-results/`.

Humans do not need to launch the development services or load the extension to verify changes. Manual Chrome loading is reserved for exploratory product review.

## Real Google integration lane

The API exposes a separately gated read-only discovery surface for real GTM accounts and containers:

- `GET /api/google/status` reports whether Google discovery is enabled.
- `GET /api/google/gtm/accounts` lists accessible GTM accounts and containers only when `GOOGLE_OAUTH_ACCESS_TOKEN` is set server-side and the caller provides the configured admin bearer token.

The extension remembers GA4 Measurement IDs and public GTM Container IDs by hostname after a successful setup generation. Those saved IDs are site configuration, not Google API credentials; OAuth is still required for account discovery or GTM workspace mutation.

The extension detects GTM and GA4 IDs visible on the current page, auto-fills the inferred site configuration, and compares detected IDs to saved configuration. Advanced manual fallback exists for operators, but the primary product path does not require users to type container or measurement IDs. Page detection confirms instrumentation signals; it does not prove GTM account ownership or GA4 platform processing.

Ordinary local verification remains credential-free. The optional `GOOGLE_TAG_MANAGER_API_BASE_URL` environment variable exists for disposable integration tests or mocks.

## Hosted API builds

The API routes can run locally through `apps/api/src/server.ts` or on Vercel through explicit root `api/` function entrypoints.

The extension points at the local API by default. To build it against a hosted API, set `GTM_OBSERVABILITY_API_BASE`:

```bash
GTM_OBSERVABILITY_API_BASE=https://your-api.vercel.app npm run build:extension
```

For the current production API, use:

```bash
npm run build:extension:prod
```

That command writes to `apps/extension/prod-dist`, which is the folder to load as an unpacked Chrome extension for production-style testing. Local verification still uses `apps/extension/dist`.

During product testing, keep this running to rebuild `prod-dist` whenever extension source files change:

```bash
npm run watch:extension:prod
```

Chrome may still require clicking Reload for the unpacked extension on `chrome://extensions`, but you do not need to choose the extension folder again.

Security and production-publish guardrails are documented in [Security and Publishing Notes](docs/security-and-publishing.md).

The current release status and remaining human acceptance test are in [Current Release Status](docs/pre-merge-checklist.md).
