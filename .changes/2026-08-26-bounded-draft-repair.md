# Connect bounded draft repair

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/06-preview-repair-version.md`

## Summary

Connect failed exact-draft evidence to a durable, two-attempt repair ledger, a
separately reviewed managed-entity repair, provider revalidation, and a new exact
preview checkpoint.

## Why

Exact-preview failures previously stopped safely but could not recover a drifted
managed entity without leaving the website-agent workflow.

## Behavior

Only failed evidence bound to the current setup, workspace, and GTM preview may enter
repair. The runner re-plans the unchanged generated setup, offers review only when a
concrete managed-entity create or update exists, preserves the tracking intent and
setup fingerprint, and records each result in a maximum-two-attempt ledger. Ambiguous
or exhausted repairs stop. An approved repair is applied and provider-validated, then
returns new workspace and preview fingerprints for another exact browser run. It
cannot create a version or publish directly. Model diagnosis and arbitrary setup
changes remain out of scope.

## Regression coverage

`packages/core/src/draft-verification.test.ts` covers exact failed-evidence binding,
intent preservation, final-attempt verification, ambiguity, and exhaustion.
`apps/api/src/workflow-runner.test.ts` covers durable proposal, no write before review,
exact plan approval, reapplication, revalidation, refreshed preview evidence, and
stopping when no known repair exists. `tests/e2e/conversational-form.spec.ts` covers
the failed run, privacy-safe repair request, visible action review, separate approval,
and mandatory new exact-preview binding.

## Verification

`npm run verify` passed preflight and documentation checks, all workspace typechecks,
411 deterministic tests across 51 files, all builds, and 64 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-bounded-draft-repair.md`. Headed Chromium covered a
missing-request failure, concrete repair review, revalidation, refreshed fingerprints,
and attacker-shaped/private page input. The initial receipt-order finding was fixed
and protected with in-viewport assertions. No unresolved finding remains.

## Documentation

Updated the active repair issue, setup-engine acceptance state, Stage 1 handoff, and
GTM workflow operator runbook.
