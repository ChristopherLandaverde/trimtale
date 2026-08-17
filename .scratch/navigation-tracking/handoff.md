# Navigation Tracking MVP Handoff

## Current state

The first autonomous vertical slice is implemented:

- Chrome side-panel extension discovers and confirms navigation scope.
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
- Extension builds can target a hosted API by setting `GTM_OBSERVABILITY_API_BASE`.
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

1. Link/deploy the Vercel API project and build an extension pointed at that hosted API.
2. Use ConsentFlow as the real GTM-installed proving ground for the no-login import/preview workflow.
3. Exchange a user OAuth authorization code for an access token instead of relying on an externally supplied token.
4. Retrieve a disposable container's current entity context.
5. Import or create the generated setup in an isolated workspace.
6. Run GTM Preview and capture browser evidence.
7. Delete or retain the disposable workspace according to an explicit test policy.

Keep the local harness deterministic and credential-free. Do not make ordinary verification depend on Google availability.
