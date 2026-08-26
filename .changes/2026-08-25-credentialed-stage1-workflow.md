# Add the credentialed Stage 1 workflow

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/11-credentialed-stage1-workflow.md`

## Summary

Add one explicit launcher for the authenticated Stage 1 website-agent workflow and
lock every GTM mutation in that session to the disposable container's public ID.

## Why

The current controlled workflow proves product sequencing but not the real Google and
Tag Assistant handoff. This lane makes that remaining proof repeatable without moving
tag setup into the portal or exposing a general Google mutation interface.

## Behavior

`npm run smoke:google:stage1` builds the product, starts the authenticated backend,
loads the production extension in a persistent headed Chromium profile, verifies the
exact ConsentFlow origin and `GTM-PCJ3Q5RK`, and leaves the browser open for the
supported human-assisted journey. Only this explicit mode enables publication and it
binds prepare, apply, validate, version, publish, and rollback calls to that public ID.
Ordinary saved Google sessions still force publication off. Portal work, server-side
GTM, MCP integration, new event types, and undocumented Tag Assistant automation stay
out of scope.

## Regression coverage

`scripts/google-session.test.ts` covers explicit session mode and target validation.
`scripts/stage1-google-smoke.test.ts` covers the launcher environment, website target,
container ID, and extension identity. Google client tests prove off-target workspace,
publication, and rollback attempts stop before a provider request.

## Verification

The focused 38-test regression set and `npm run check` passed. Read-only credentialed
recognition and a no-mutation launcher readiness run matched the exact target. The full
`npm run verify` gate passed preflight, typechecks, builds, and all 385 deterministic
tests; four existing Chromium screenshot comparisons failed while their behavioral
journeys passed. No visual baseline was changed.

## Exploratory review

See `docs/reviews/2026-08-25-credentialed-stage1-workflow-readiness.md`. Launcher
readiness is proven. The real Tag Assistant draft handoff, publication, and live
verification remain outstanding, so the implementation issue stays in progress.

## Documentation

Updated the GTM workflow runbook, current Stage 1 handoff, and implementation issue
with the exact command, authority boundary, evidence, and remaining human-assisted
step.
