# Resume validated exact preview

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/11-credentialed-stage1-workflow.md`

## Summary

Resume a reused validated setup operation after a browser restart and restore its exact
preview binding in the website agent.

## Why

The supported Google sign-in and Tag Assistant handoff requires switching from normal
Chrome back to the managed verification browser. The durable operation survived that
switch, but the website agent previously rejected its reused validated state.

## Behavior

A reused operation is resumable only when its identifier is valid and its persisted
status is `validated`. The extension calls the existing resume endpoint, validates the
returned setup, workspace, and preview fingerprints, and restores the exact browser-run
action. It does not reapply the plan, automate Tag Assistant, widen provider authority,
or accept another operation status.

## Regression coverage

`tests/e2e/conversational-form.spec.ts` reproduces the browser restart with a reused
validated operation. It requires one resume request, the saved preview fingerprint,
the exact browser-run action, and no repeated apply action.

## Verification

`npm run verify` passed preflight, 86 change records, every workspace
typecheck, 418 deterministic tests across 51 files, all builds, and 71 Chromium
journeys.

## Exploratory review

See `docs/reviews/2026-08-26-resume-validated-preview.md`. Headed review covered the
resumed happy path, malformed-plan blocking, and an attacker-labeled form with no
unresolved finding.

## Documentation

Updated Issue 11 and the Stage 1 handoff with the connected Tag Assistant evidence and
browser-restart behavior.
