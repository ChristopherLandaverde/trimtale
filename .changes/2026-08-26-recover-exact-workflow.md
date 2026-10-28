# Recover exact workflow interruptions

Change record version: 2

Issues: `.scratch/gtm-setup-engine/issues/21-filter-form-collection-requests.md`,
`.scratch/gtm-setup-engine/issues/22-resume-publication-gates.md`

## Summary

Classify form delivery from `generate_lead` requests only and restore exact version or
publication state after the website agent restarts.

## Why

The real credentialed workflow exposed two interruption defects: GA4's automatic
`form_start` could make one lead request appear duplicated, and durable versioned or
published operations could not restore their next user action after a browser restart.

## Behavior

Unrelated GA4 requests neither create false lead duplicates nor satisfy lead evidence.
A reused versioned operation restores exact publication review, while a reused
published operation restores live verification. Application, evidence fingerprints,
publication approval, rollback authority, Google sign-in, and the supported human
Tag Assistant handoff remain unchanged.

## Regression coverage

`packages/core/src/form-verdict.test.ts` covers one `form_start` plus one complete
`generate_lead`, `form_start` alone, duplicate lead requests, and missing parameters.
`apps/api/src/workflow-runner.test.ts` covers published resume.
`tests/e2e/conversational-form.spec.ts` covers versioned and published browser-restart
recovery without repeated application or publication actions.

## Verification

`npm run verify` passed all preflight and documentation checks, workspace typechecks,
421 deterministic tests across 51 files, all builds, and 73 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-exact-workflow-recovery.md`. A real exact preview passed,
created immutable version `6`, and recovered its exact review after reload. Exact
approval then published it; a clean no-debug-cookie reload restored and passed live
verification. A negative off-screen path stopped without a version. No blocker or
high-severity finding remains; Issue 23 records the medium narrow-viewport overlap.

## Documentation

Resolved Issues 11, 21, and 22, added Issue 23, and recorded the real exact-preview,
publication, live-verification, and recovery evidence. The Stage 1 acceptance
checklist now records real-browser draft verification as complete.
