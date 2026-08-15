# Deployment-Assisted Verification Handoff

## Resume point

- Repository: `/home/oppie/projects/gtm-observability`
- Branch: `feature/google-gtm-integration`
- Current commit before the workspace slice: `a778d4f Add deployment integration handoff`
- Working tree was clean at handoff creation.

Read, in order:

1. `AGENTS.md`
2. `CONTEXT.md`
3. `.scratch/navigation-tracking/handoff.md`
4. `.scratch/deployment-assisted-verification/spec.md`
5. This handoff

Then run `npm run verify` before changing behavior.

## Completed slices

### Read-only Google integration

- Backend OAuth is configured through environment variables.
- OAuth state is one-time and expires after ten minutes.
- Access tokens refresh when Google supplies a refresh token.
- Account and container discovery handles pagination.
- Container entity context retrieves workspaces and the live version read-only.
- Ordinary verification remains credential-free and never calls Google.

### Opt-in container creation

- Disabled unless `GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true`.
- Adds only `https://www.googleapis.com/auth/tagmanager.edit.containers` to the existing read-only scope.
- The creation route requires `purpose=verification-target` and a valid HTTPS target.
- It can create a new web container but cannot update/delete existing containers or create/publish versions.

### Vercel verification target

- `apps/verification-target` builds a deterministic website with configurable GTM script and noscript installation.
- `npm run deploy:verification-target -- --container GTM-XXXXXXX --project consentflow` creates a preview deployment only.
- The command verifies protected previews through `vercel curl` and fails unless the expected container marker and script are present.
- Production promotion is not implemented.

### Browser harness stabilization

- The extension service worker now buffers recent analytics requests per tab so a beacon observed just before click evidence is still correlated.
- The formerly intermittent navigation E2E passed five consecutive runs after the fix.

## Live integration resources

- Google Cloud project: `gtm-observability`
- GTM account: `Premium Carpet Company Test` (`6305900974`)
- Dedicated container: `ConsentFlow Verification`
- Container ID: `261236292`
- Public ID: `GTM-PCJ3Q5RK`
- Container usage context: `web`
- Associated domain: `consentflow-psi.vercel.app`
- Protected preview: `https://consentflow-j98gp45fr-christopherlandaverdes-projects.vercel.app`
- Vercel project: `consentflow`

The preview was authenticated and verified to contain `GTM-PCJ3Q5RK` in its marker, GTM script, and noscript fallback. The production ConsentFlow alias was not changed. No GTM version was created or published.

## Local credential and process state

- The downloaded Google OAuth client JSON is outside the repository under `/home/oppie/Downloads/`.
- Never stage that JSON, `.env.local`, `.vercel/`, Vercel OIDC values, access tokens, or refresh tokens.
- OAuth tokens are memory-only and disappear when the API process exits.
- A new session should assume reauthorization is required.

To restart the API, load the OAuth client ID and secret from the downloaded web-client JSON, set:

```text
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8787/api/google/oauth/callback
GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true
```

Then start `@gtm-observability/api`, open `http://127.0.0.1:8787/api/google/oauth/start`, and confirm `/api/google/status` reports `connected: true` and `containerWritesEnabled: true`.

Do not commit a shell command containing expanded credential values.

## Required safety policy for the next slice

- Use only `ConsentFlow Verification`; do not use or alter FOCO or another existing container.
- Create a new isolated workspace with a recognizable GTM Observability name.
- Do not change the default workspace.
- Do not publish, create a production version, or promote the Vercel preview.
- Record every created resource identifier before creating entities.
- If entity creation partially fails, retain the isolated workspace for inspection rather than deleting evidence automatically.
- Workspace deletion requires a separate explicit decision after evidence is captured.
- Do not manually apply GTM entities from a terminal. The tracking practitioner must initiate setup approval from the Chrome extension.

## Next implementation slice

Exercise the practitioner-controlled extension flow against `ConsentFlow Verification`:

1. Start the API with the tracking-setup gate and exact container allowlist.
2. Reload the unpacked extension and connect Google from the side panel.
3. Discover and confirm navigation scope on the verification target.
4. Review the proposed entities and let the practitioner click **Create in GTM**.
5. Record the newly created workspace and inspect its status.
6. Use GTM Preview to obtain browser evidence against the protected Vercel preview.
7. Stop before version creation or publishing.

The open policy question is workspace retention: retain by default after the first real run so failures and evidence remain inspectable.

### Workspace slice progress

- A separate `GOOGLE_GTM_WORKSPACE_WRITES_ENABLED` gate is implemented.
- `GOOGLE_GTM_WORKSPACE_CONTAINER_PATH` must exactly match the requested container.
- Creation requires `purpose=isolated-verification-workspace` and returns `retain-for-evidence`.
- Workspace status inspection is implemented separately so the created identifier is recorded first.
- Quick preview remains deferred because Google requires the additional `tagmanager.edit.containerversions` scope.
- Live workspace `3` was created as `GTM Observability - Navigation - 20260815T171400Z`.
- Its baseline status was empty before entity application.
- Entity writes are implemented behind `GOOGLE_GTM_ENTITY_WRITES_ENABLED` and exact path `GOOGLE_GTM_ENTITY_WORKSPACE_PATH`.
- Product correction: the live workspace remains empty. Entity application must be wired to an explicit extension action before any real apply occurs.
- The extension now connects Google, loads destination containers, presents the proposed changes, and exposes an explicit **Create in GTM** setup-approval action.
- `GOOGLE_GTM_TRACKING_SETUP_WRITES_ENABLED` and exact `GOOGLE_GTM_TRACKING_SETUP_CONTAINER_PATH` gate one extension-facing transaction that creates a fresh isolated workspace and its entities without publishing.
- The deterministic browser test exercises the connected destination and practitioner approval flow without calling Google.
- The extension action now opens an on-page, bottom-centered command overlay instead of the side panel. Discovery expands the overlay upward and outlines selected links on the website; the side panel remains a secondary/fallback surface.

## Verification evidence

The latest completion gate passed:

- Strict TypeScript checks across all workspaces.
- 22 unit/scenario tests across four test files.
- Builds for core, API, fixture site, verification target, and extension.
- Chromium extension E2E.

Relevant commits:

- `56a32fb Add read-only Google Tag Manager integration`
- `cb2238b Add Vercel verification target deployment`
- `6eb894c Add opt-in GTM container creation`
- `074d2a1 Record live verification target pairing`
