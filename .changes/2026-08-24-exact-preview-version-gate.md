# Gate immutable versions on exact browser preview

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/06-preview-repair-version.md`

## Summary

Reorder durable GTM operations so managed-workspace application and validation pause
for browser preview, then accept only passing evidence bound to the exact setup,
workspace, and GTM preview fingerprints before creating an immutable version.

## Why

A compiler-valid workspace is not a verified website setup. Showing a container
version before exercising its exact draft would weaken the product's central promise
of reducing time to a verified setup.

## Behavior

New operations return an `awaiting_preview` checkpoint after application and provider
validation. Chat displays the exact fingerprints and a supported human-assisted GTM
and Tag Assistant handoff. Confirmed form and phone-click runs return normalized
browser evidence through a protected endpoint; only an accepted, current binding can
advance the operation to version creation. Missing, failed, malformed, stale, or
mismatched evidence creates no version and grants no publication authority.

Previously persisted operations without the new preview policy remain replayable for
migration compatibility. The handoff does not automate undocumented Tag Assistant
session interfaces, and authenticated real-Google interoperability remains to be
smoke-tested.

## Regression coverage

Core tests cover the new `validated -> run_preview -> draft_verified ->
create_version` contract and exact binding validity. API tests prove pause/resume,
idempotent binding, and protected evidence submission. Chromium journeys prove that a
lead form and privacy-safe phone click cannot display an immutable version before an
exact browser run and do display it after accepted evidence.

## Verification

`npm run verify` passes all preflight and change-document checks, workspace typechecks,
377 unit tests, and 52 Playwright Chromium journeys. Both exact-preview version-gate
journeys pass within the complete suite.

## Exploratory review

Controlled Chromium review confirmed the visible no-version checkpoint, supported
handoff instructions, exact fingerprint display, guided browser run, and post-evidence
version receipt. A real authenticated GTM and Tag Assistant session was not exercised
in this environment.

## Documentation

Issue 06 and the Stage 1 progress record now distinguish the implemented version gate
from the remaining real-provider smoke test and bounded repair workflow.
