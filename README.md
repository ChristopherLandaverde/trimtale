# GTM Observability

A site-aware analytics agent for setting up and verifying website conversions from the website itself.

This project does not replace GTM. GTM remains the configuration, execution, versioning, environment, and publishing layer. This product connects GTM configuration evidence with browser-runtime evidence so teams can detect broken tracking, understand why it broke, test corrections, and deploy verified GTM changes.

## Product promise

Describe what should count as a conversion. The system discovers the relevant website interactions, turns the confirmed intent into a reviewable GTM change, tests the real user journey, and presents evidence that the setup works.

Lead-generation websites are the initial market: qualified form submissions, appointment requests, phone intent, email intent, and primary lead actions. The underlying product model is broader conversion measurement, so purchases, registrations, trials, and subscriptions can be supported later without redefining the product.

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
    -> preview one unambiguous group on the page
    -> press Enter to confirm, Esc to remove, or change the selection
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
npm run agent -- preflight
npm run verify
```

The local preflight checks supported Node and npm versions, the lockfile, installed
dependencies, required repository scripts, and Playwright's managed Chromium binary.
It runs automatically at the start of `npm run verify`.

`npm run verify` is the agent-owned completion gate. It:

- Runs strict TypeScript checks.
- Runs the deterministic scenario corpus.
- Builds the backend, fixture site, shared package, and extension.
- Starts the local services.
- Launches Playwright's managed Chromium with the extension preloaded.
- Exercises discovery, generation, download validation, and guided browser verification.
- Saves Playwright traces and failure evidence under `test-results/`.

Humans do not need to launch the development services or load the extension to verify changes. Manual Chrome loading is reserved for exploratory product review.

#### Local agent model

Navigation-scope interpretation is local-first. When the API is running, it uses the
fixed loopback Ollama endpoint at `http://127.0.0.1:11434` and defaults to the installed
`qwen3:30b` model. Set `OLLAMA_MODEL` to another installed model, or set
`OLLAMA_AGENT_ENABLED=false` to use only the deterministic fallback.

The model receives bounded user messages and privacy-filtered navigation-group
summaries containing only group ID, inert label, page region, and target count. It
never receives selectors, URLs, HTML, form values, browser storage, Google credentials,
or the GTM container inventory. Explicit phrases such as “header, not footer” resolve
deterministically; fuzzy wording such as “the menu at the top” may use Ollama. Every
single-group suggestion is highlighted immediately as a reversible page preview and
still requires practitioner confirmation with `Enter` or the visible action. `Escape`
or Remove clears the preview without changing GTM; zero or multiple matches remain a
group-level clarification.

One 32-case provider-neutral corpus automates navigation-scope acceptance without
asserting exact model prose. The ordinary `npm test` gate validates and replays every
case deterministically. Two explicit functional lanes exercise the production routing
boundary against local Ollama:

```bash
npm run evaluate:navigation:smoke
npm run evaluate:navigation:full
```

The smoke lane runs 15 representative cases; the full lane runs all 32. Explicit and
generic cases stay deterministic, so Ollama receives only genuinely fuzzy cases. Both
commands emit only counts, failed case IDs, supplied group IDs, ambiguity enums, and
failure classes—never practitioner messages, model prose, prompts, or credentials.
These are functional acceptance checks, not comparative model benchmarks.

#### Agent command harness

Routine local agent work is available through one closed, repository-owned command surface:

```bash
npm run agent -- help
npm run agent -- preflight
npm run agent -- status
npm run agent -- check
npm run agent -- test
npm run agent -- e2e
npm run agent -- verify
```

The harness also supports `build`, `change-docs`, `diff`, and `inspect`. Each name
maps to a fixed local `npm` or read-only `git` invocation, always runs from the
repository root, and rejects additional arguments. It does not provide dependency
installation, arbitrary `npx` execution, credentialed integrations, remote Git
operations, destructive commands, or a shell escape hatch. Those operations retain
their own explicit authorization boundary.

Like the direct `npm` and `git` commands it replaces, the harness inherits the
caller's environment so standard executable lookup and npm configuration continue to
work. It does not load environment files or select any credentialed script. Local
`.env*.local`, `.vercel/`, and generated `.build/` artifacts are ignored repository-wide
to keep credentials, deployment linkage, and generated output out of commits.

### Google Tag Manager integration

The API can run a separately gated OAuth flow and discover the connected tracking practitioner's GTM accounts and containers. It is read-only by default and is disabled unless the OAuth variables are set:

```bash
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/api/google/oauth/callback
EXTENSION_ORIGIN=chrome-extension://<extension-id>
npm run dev:api
```

Find the unpacked extension ID on `chrome://extensions` and configure its exact
`chrome-extension://` origin. Google-backed API routes fail closed for browser
origins when `EXTENSION_ORIGIN` is absent, `*`, or different from the request origin;
they never emit a wildcard CORS header. Direct OAuth navigation and server-side
clients that do not send an `Origin` header remain supported.

Register the exact redirect URI in the Google Cloud OAuth client and enable the Tag
Manager API. Then open `http://127.0.0.1:8787/api/google/oauth/start`; after consent,
`GET /api/google/accounts` returns each accessible account with its containers. Set
`GOOGLE_OAUTH_TOKEN_STORE` to a backend-local path to persist only an owner-readable
refresh token and reconnect after restart without another browser consent. Without that
setting, authorization remains memory-only. Ordinary `npm run verify` remains
credential-free and never calls Google.

Before starting an explicitly credentialed workspace-write session, validate only the
presence and shape of its configuration without printing values:

```bash
npm run preflight:google
```

This Google preflight remains outside `npm run agent` and ordinary verification. It
checks the OAuth client variables, exact local callback, exact extension origin, and
explicit container-write switch; it does not contact Google or prove live access.

Container edits require `GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true` before consent.
Request publish consent separately with
`GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true`; this does not enable publication.
For an explicitly approved publication session, also set
`GOOGLE_GTM_PUBLICATION_ENABLED=true` and run `npm run preflight:publication`.
Ordinary Google preflight, CI, and `npm run verify` never enable or call publication.

See the [GTM setup workflow operator runbook](docs/engineering/gtm-workflow-runbook.md)
for durable operation paths, exact-fingerprint approval, API quota behavior,
post-publication evidence, and rollback.

After choosing a disposable container, `GET /api/google/accounts/:accountId/containers/:containerId/context` retrieves its workspaces and live version entity context. This includes the existing tags, triggers, variables, and built-in variables needed to plan an isolated workspace change. It remains read-only.

For an opt-in live smoke check, supply a short-lived token carrying the same read-only scope:

```bash
GOOGLE_GTM_ACCESS_TOKEN=... npm run test:google
```

This command only lists accounts and containers. It is intentionally separate from `npm run verify`.
