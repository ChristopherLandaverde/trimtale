# Navigation Tracking MVP Handoff

## Current state

The first autonomous vertical slice is implemented:

- Chrome extension workbench tab discovers and confirms navigation scope.
- Local API validates the request and generates a partial GTM container file.
- Guided verification correlates a confirmed click with an observed GA4-style request.
- Browser verification remains separate from platform confirmation.
- A deterministic fixture site and Playwright-managed Chromium exercise the workflow without human browser operation.
- The local harness uses API port `18787` and fixture port `14173` to avoid common dev-server collisions.
- A gated read-only Google integration foundation is in place:
  - `GET /api/google/status`
  - `GET /api/google/gtm/accounts`
  - `GOOGLE_OAUTH_ACCESS_TOKEN` is required before real GTM discovery can run.
- The API routing is shared by the local Node server and the Vercel Function entrypoints under `api/`.
- Extension builds can target a hosted API by setting `GTM_OBSERVABILITY_API_BASE`. The production testing build writes to `apps/extension/prod-dist`; the local E2E build writes to `apps/extension/dist`.
- Guided verification now produces a local JSON evidence report with per-link browser verdicts and the platform-confirmation boundary.
- The extension action opens a persistent workbench tab. It passes the source tab id into the workbench so discovery and verification stay bound to the site the practitioner opened the extension from.
- The workbench includes a GTM import and Preview checklist before guided verification starts.
- Read-only GTM discovery follows Google `nextPageToken` pagination for both account and container lists.
- The branch has been fast-forward merged into `main` and deployed to `https://gtm-observability.vercel.app`.
- `npm run verify` passes type checks, eleven unit/scenario tests, builds, and the extension E2E test.

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

Validate the merged no-login flow on the real GTM-installed ConsentFlow site, then continue the separately gated real-Google integration lane:

1. Build the production extension with `npm run build:extension:prod`.
2. Use ConsentFlow as the real GTM-installed proving ground for the no-login import/preview workflow.
3. Import the generated file with Merge into a new GTM workspace and run Preview.
4. Exchange a user OAuth authorization code for an access token instead of relying on an externally supplied token.
5. Retrieve a disposable container's current entity context.
6. Import or create the generated setup in an isolated workspace.
7. Run GTM Preview and capture browser evidence.
8. Delete or retain the disposable workspace according to an explicit test policy.

Keep the local harness deterministic and credential-free. Do not make ordinary verification depend on Google availability.
