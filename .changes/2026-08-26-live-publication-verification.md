# Connect live publication verification

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/15-live-publication-verification.md`

## Summary

Continue the website-agent workflow from Google-confirmed publication through live
browser evidence and a separately reviewed exact rollback when that evidence fails.

## Why

Publication alone does not prove the reviewed measurement behavior works on the live
site. The operation needs an evidence-bound terminal result and a guarded recovery
path without giving the model or an inconclusive run rollback authority.

## Behavior

After publication, the website agent can run the same confirmed interaction against
the live container and submit privacy-safe evidence bound to the published version
fingerprint. Passing evidence completes the operation. Failed evidence records the
prior-live fingerprint and exposes a separate rollback review and confirmation.
Inconclusive evidence remains retryable with rollback locked. Automatic rollback,
GA4 reporting confirmation, portal identity/history, and draft repair remain out of
scope.

## Regression coverage

`packages/core/src/publication.test.ts` distinguishes passing, failed, and
inconclusive live evidence. `apps/api/src/workflow-runner.test.ts` covers exact
published-fingerprint binding, durable completion, rollback eligibility, wrong-target
rejection, and explicit rollback. `tests/e2e/conversational-form.spec.ts` covers the
passing workflow, failed live evidence, separate rollback review, exact request
bodies, and private or attacker-shaped page values that never cross the extension
boundary.

## Verification

`npm run verify` passed all preflight checks, 72 change records, workspace typechecks,
406 deterministic tests across 51 files, all builds, and 62 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-live-publication-verification.md`. The headed review
covered passing live evidence, failed live evidence, exact rollback review and
confirmation, and an attacker-shaped page sentinel. No unresolved finding remains.

## Documentation

Updated the Stage 1 handoff, current capability inventory, GTM workflow runbook, and
publication issues with the live evidence, retry, and rollback authority boundaries.
