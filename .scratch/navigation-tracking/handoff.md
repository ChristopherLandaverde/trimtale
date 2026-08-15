# Navigation Tracking MVP Handoff

## Current state

The first autonomous vertical slice and the first read-only Google integration slice are implemented:

- Chrome side-panel extension discovers and confirms navigation scope.
- Local API validates the request and generates a partial GTM container file.
- Guided verification correlates a confirmed click with an observed GA4-style request.
- Browser verification remains separate from platform confirmation.
- A deterministic fixture site and Playwright-managed Chromium exercise the workflow without human browser operation.
- Backend-only Google OAuth requests `tagmanager.readonly`, keeps tokens in memory, refreshes expired access tokens, and protects callbacks with one-time state.
- The Google integration discovers every accessible account and container across paginated API responses.
- A selected disposable container's workspaces and live version entity context can be retrieved read-only.
- `npm run test:google` is an explicit-credential live smoke lane; ordinary verification never calls Google.
- `npm run verify` passes type checks, ten unit/scenario tests, builds, and the extension E2E test.

## Start here

Read, in order:

1. `AGENTS.md`
2. `CONTEXT.md`
3. `.scratch/navigation-tracking/spec.md`
4. `README.md`

Then run `npm run verify` before changing behavior.

## Important boundary

The generated file matches the documented GTM entity/export shape but has not yet been imported into a disposable real GTM container. The local harness proves the extension workflow and evidence model; it does not prove Google-side import or platform processing.

## Recommended next slice

Continue the separately gated real-Google integration lane:

1. Define an explicit disposable-workspace retention/deletion policy.
2. Add the minimum write scopes needed to create an isolated workspace only when that flow begins.
3. Create the generated setup in that isolated workspace.
4. Run GTM Preview and capture browser evidence.
5. Delete or retain the disposable workspace according to the test policy.

Keep the local harness deterministic and credential-free. Do not make ordinary verification depend on Google availability.

## Follow-on product insight

Deployment automation can materially reduce time to verified setup by creating a ready-to-check verification target with the isolated GTM container already configured. The proposed provider-neutral workflow and first Vercel slice are recorded in `.scratch/deployment-assisted-verification/spec.md`.

The first Vercel slice is implemented and proven with a placeholder container on a protected preview. The next live step is to create a dedicated GTM web container and redeploy the verification target with its real public ID.

Dedicated web-container creation is implemented as an opt-in backend capability using `tagmanager.edit.containers`. It remains disabled until `GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true` is configured and the practitioner authorizes the added scope.

Live validation created `ConsentFlow Verification` (`GTM-PCJ3Q5RK`) and paired it with protected preview `https://consentflow-j98gp45fr-christopherlandaverdes-projects.vercel.app`. The preview installation was verified; production and GTM publishing remain untouched.
