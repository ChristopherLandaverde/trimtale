# Bind exact-draft evidence and bounded repair

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/06-preview-repair-version.md`

## Summary

Add an evidence envelope bound to the generated setup, managed workspace, and GTM
preview fingerprints, plus an intent-preserving repair ledger.

## Why

Live-site or stale browser evidence must never be presented as proof of the exact
workspace draft that will become a version.

## Behavior

Only passing browser evidence for the same operation and tracking specification can
produce a verified-draft binding. Setup, workspace, or preview changes invalidate it.
Repair attempts preserve the confirmed intent fingerprint, stop on ambiguity, and
cannot exceed a bounded budget.

## Regression coverage

`packages/core/src/draft-verification.test.ts` covers binding, stale evidence,
mislabeled previews, ambiguity, attempt exhaustion, and intent changes.

## Verification

`npm run verify` passes 369 unit tests and 51 Playwright Chromium journeys.

## Exploratory review

The existing Chromium journeys remain green. Exact GTM workspace-preview transport is
not yet connected to the browser agent and remains tracked by Issue 06.

## Documentation

Issue 06 records the remaining real-preview integration boundary.
