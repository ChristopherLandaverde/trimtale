# Lock the Stage 1 launcher URL

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/11-credentialed-stage1-workflow.md`

## Summary

Require the credentialed Stage 1 launcher to match the exact disposable website path
and query instead of accepting every page on the same origin.

## Why

The launcher enables real GTM writes and publication for one contained session. Its
page guard claimed an exact target but an origin-only comparison allowed same-origin
alternate routes before the workflow reached its ready state.

## Behavior

The launcher now accepts only the configured ConsentFlow origin, root path, and empty
query. A different origin, same-origin path, attacker-shaped query, or observed GTM
container stops readiness. URL fragments remain irrelevant because they do not select
a different server resource. The GTM public-ID lock, extension-origin lock, provider
permissions, and human approval checkpoints are unchanged.

## Regression coverage

`scripts/stage1-google-smoke.test.ts` first reproduced the origin-only gap, then proves
that same-origin `/admin` and attacker-query URLs fail alongside the existing wrong-
origin and wrong-container cases.

## Verification

`npm run verify` passed preflight and documentation checks, all workspace typechecks,
411 deterministic tests across 51 files, all builds, and 70 Chromium journeys.

## Exploratory review

Interactive review is not applicable because this is a pre-launch safety assertion
with no product UI change. The focused unit regression exercises the exact accepted
and rejected URL inputs without opening a write-enabled session.

## Documentation

Updated the credentialed Stage 1 issue, workflow runbook, and current handoff baseline.
