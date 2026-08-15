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

### Development

Requirements: Node.js 22+ and npm 10+.

```bash
npm install
npm run verify
```

`npm run verify` is the agent-owned completion gate. It:

- Runs strict TypeScript checks.
- Runs the deterministic scenario corpus.
- Builds the backend, fixture site, shared package, and extension.
- Starts the local services.
- Launches Playwright's managed Chromium with the extension preloaded.
- Exercises discovery, generation, download validation, and guided browser verification.
- Saves Playwright traces and failure evidence under `test-results/`.

Humans do not need to launch the development services or load the extension to verify changes. Manual Chrome loading is reserved for exploratory product review.

### Read-only Google Tag Manager integration

The API can run a separately gated OAuth flow and discover the connected tracking practitioner's GTM accounts and containers. This lane requests only the `tagmanager.readonly` scope and is disabled unless all three variables are set:

```bash
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/api/google/oauth/callback
npm run dev:api
```

Register the exact redirect URI in the Google Cloud OAuth client and enable the Tag Manager API. Then open `http://127.0.0.1:8787/api/google/oauth/start`; after consent, `GET /api/google/accounts` returns each accessible account with its containers. OAuth tokens are held only in backend memory and are lost when the process exits. Ordinary `npm run verify` remains credential-free and never calls Google.

After choosing a disposable container, `GET /api/google/accounts/:accountId/containers/:containerId/context` retrieves its workspaces and live version entity context. This includes the existing tags, triggers, variables, and built-in variables needed to plan an isolated workspace change. It remains read-only.

Container creation is a separate opt-in capability. Add the `tagmanager.edit.containers` scope to the Google Auth Platform client, set `GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true`, restart the API, and authorize again. The backend then permits only this explicit request shape:

```http
POST /api/google/accounts/:accountId/containers
Content-Type: application/json

{
  "name": "ConsentFlow Verification",
  "verificationTarget": "https://consentflow-psi.vercel.app",
  "purpose": "verification-target"
}
```

The route creates a web container associated with the verification-target hostname. The capability does not update or delete containers, create or publish versions, or modify production deployments. Without the environment flag, the route returns `403` and OAuth continues to request read-only access only.

Isolated workspace creation has its own gate and an exact-container allowlist:

```text
GOOGLE_GTM_WORKSPACE_WRITES_ENABLED=true
GOOGLE_GTM_WORKSPACE_CONTAINER_PATH=accounts/6305900974/containers/261236292
```

With those values configured and OAuth authorized for `tagmanager.edit.containers`, create and inspect only the allowlisted workspace:

```http
POST /api/google/accounts/6305900974/containers/261236292/workspaces
Content-Type: application/json

{
  "name": "GTM Observability - Navigation - 20260815",
  "purpose": "isolated-verification-workspace"
}

GET /api/google/accounts/6305900974/containers/261236292/workspaces/:workspaceId/status
```

The create response records the workspace before any entity writes, with retention set to `retain-for-evidence`. These routes cannot target another container and expose no delete, version-creation, quick-preview, or publish operation.

Navigation entity creation is a third, narrower mode bound to one recorded workspace:

```text
GOOGLE_GTM_ENTITY_WRITES_ENABLED=true
GOOGLE_GTM_ENTITY_WORKSPACE_PATH=accounts/6305900974/containers/261236292/workspaces/3
```

`POST /api/google/accounts/:accountId/containers/:containerId/workspaces/:workspaceId/navigation-setup` requires `purpose=navigation-tracking-setup`, a GA4-format measurement ID, and 1–50 HTTPS navigation URLs. It enables Click Text and Click URL, creates one scoped link-click trigger, then creates one `navigation_click` GA4 event tag linked to the returned trigger ID. Partial failures retain the workspace for inspection. No rollback, deletion, version, preview, or publish call is made automatically.

The practitioner-facing extension flow uses one separately gated transaction instead of those harness routes:

```text
GOOGLE_GTM_TRACKING_SETUP_WRITES_ENABLED=true
GOOGLE_GTM_TRACKING_SETUP_CONTAINER_PATH=accounts/6305900974/containers/261236292
```

After the practitioner connects Google, selects the allowlisted destination, confirms discovered navigation scope, and reviews the proposal, the extension's **Create in GTM** button calls `POST /api/google/accounts/:accountId/containers/:containerId/tracking-setups` with `approval=create-isolated-tracking-setup`. The backend creates a fresh isolated workspace and applies the reviewed setup. It retains partial work for evidence and never creates a version or publishes the container. This is the product path; the narrower workspace/entity endpoints remain harness controls.

For an opt-in live smoke check, supply a short-lived token carrying the same read-only scope:

```bash
GOOGLE_GTM_ACCESS_TOKEN=... npm run test:google
```

This command only lists accounts and containers. It is intentionally separate from `npm run verify`.

### Vercel verification target

The verification-target app builds a small isolated website with a configurable GTM container installed in both the script and noscript positions. Deploy it to a Vercel preview without changing production:

```bash
npm run deploy:verification-target -- --container GTM-XXXXXXX --project consentflow
```

The command links only `apps/verification-target` to the selected Vercel project, creates a preview deployment, and fails unless the returned page contains the expected container marker and GTM script. A real container ID is mandatory for deployment; the credential-free local build uses `GTM-TEST000`.
