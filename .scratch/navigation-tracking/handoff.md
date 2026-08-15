# Navigation Tracking MVP Handoff

## Current state

The first autonomous vertical slice is implemented:

- Chrome side-panel extension discovers and confirms navigation scope.
- Local API validates the request and generates a partial GTM container file.
- Guided verification correlates a confirmed click with an observed GA4-style request.
- Browser verification remains separate from platform confirmation.
- A deterministic fixture site and Playwright-managed Chromium exercise the workflow without human browser operation.
- `npm run verify` passes type checks, seven unit/scenario tests, builds, and the extension E2E test.

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

Add a separately gated real-Google integration lane:

1. Configure Google OAuth behind environment variables.
2. Add read-only GTM account/container discovery.
3. Retrieve a disposable container's current entity context.
4. Import or create the generated setup in an isolated workspace.
5. Run GTM Preview and capture browser evidence.
6. Delete or retain the disposable workspace according to an explicit test policy.

Keep the local harness deterministic and credential-free. Do not make ordinary verification depend on Google availability.
