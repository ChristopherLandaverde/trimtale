# Local development

Developer and operator detail moved out of the README during the Trimtale rename. Environment variable names keep their original `GTM_OBSERVABILITY_` prefix on purpose: renaming them would break existing local and Vercel configuration.

## Setup and verification commands

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
- Validates the browser-verification evidence report download.
- Saves Playwright traces and failure evidence under `test-results/`.

Humans do not need to launch the development services or load the extension to verify changes. Manual Chrome loading is reserved for exploratory product review.

## Agent command harness

Routine local agent work is available through one closed, repository-owned command surface:

```bash
npm run agent -- help
npm run agent -- preflight
npm run agent -- status
npm run agent -- check
npm run agent -- test
npm run agent -- e2e
npm run agent -- commit
npm run agent -- update-snapshots
npm run agent -- verify
```

The harness also supports `build`, `change-docs`, `diff`, and `inspect`. Each name
maps to a fixed local `npm` or read-only `git` invocation, always runs from the
repository root, and rejects additional arguments. It does not provide dependency
installation, arbitrary `npx` execution, credentialed integrations, remote Git
operations, destructive commands, or a shell escape hatch. Those operations retain
their own explicit authorization boundary.

`update-snapshots` is the only sanctioned visual-baseline update path. It runs the
fixed `test:e2e:update-snapshots` npm script, then the generated images and Git diff
must be reviewed before committing. Never use it only to make a failing gate green.

`commit` commits only the already-staged index using the fixed message file at
`.scratch/commit-message.md`. The command refuses to run when the message file is
missing or empty, when the current branch is `main`, or when nothing is staged. A
successful commit deletes the message file. Staging and pushing remain outside the
agent harness by design.

Like the direct `npm` and `git` commands it replaces, the harness inherits the
caller's environment so standard executable lookup and npm configuration continue to
work. It does not load environment files or select any credentialed script. Local
`.env*.local`, `.vercel/`, and generated `.build/` artifacts are ignored repository-wide
to keep credentials, deployment linkage, and generated output out of commits.

## Google Tag Manager integration

The API can run a separately gated OAuth flow and discover the connected tracking practitioner's GTM accounts and containers. It is read-only by default and is disabled unless the OAuth variables are set:

```bash
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:18787/api/google/oauth/callback
EXTENSION_ORIGIN=chrome-extension://<extension-id>
npm run dev:api
```

Find the unpacked extension ID on `chrome://extensions` and configure its exact
`chrome-extension://` origin. Google-backed API routes fail closed for browser
origins when `EXTENSION_ORIGIN` is absent, `*`, or different from the request origin;
they never emit a wildcard CORS header. Direct OAuth navigation and server-side
clients that do not send an `Origin` header remain supported.

Register the exact redirect URI in the Google Cloud OAuth client and enable the Tag
Manager API. Then open `http://127.0.0.1:18787/api/google/oauth/start`; after consent,
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
`GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true`; this also requests `openid email` so
approvals record the signed-in account, and it does not enable publication. A backend
authorized before this change must reconnect Google before it can approve.
For an explicitly approved publication session, also set
`GOOGLE_GTM_PUBLICATION_ENABLED=true` and run `npm run preflight:publication`.
Ordinary Google preflight, CI, and `npm run verify` never enable or call publication.

See the [GTM setup workflow operator runbook](gtm-workflow-runbook.md)
for durable operation paths, exact-fingerprint approval, API quota behavior,
post-publication evidence, and rollback.

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

Security and production-publish guardrails are documented in [Security and Publishing Notes](../security-and-publishing.md).
