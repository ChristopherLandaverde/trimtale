# Add a safe interactive Stage 1 Chromium demo

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/09-portal-approval-publication.md`

## Summary

Add a headed Chromium launcher for manually exercising the exact-preview, immutable-
version, and chat-publication workflow with the production extension and controlled
provider responses.

## Why

The product workflow should be directly inspectable without requiring Google
credentials or risking a real workspace or live-container mutation.

## Behavior

`npm run demo:stage1` builds the current branch, loads the unpacked extension in an
isolated Chromium profile, and opens a clearly labeled safe demo page. The operator
drives the conversation and every approval. GTM, GA4, version, and publication
responses are controlled inside that isolated browser context; no real Google endpoint
is mutated.

When managed writes are available, the approved setup and managed-plan screens do not
offer the unrelated already-installed verification route. This prevents a browser-
verified dead end with no durable operation to version. The manual verification action
remains available when managed planning is unavailable and is labeled accordingly.

## Regression coverage

The launcher reuses the same response shapes and browser behavior covered by the full
Chromium publication journey. It is a manual exploratory surface, not a replacement
for automated acceptance tests.

## Verification

The repository passed 377 unit tests and 52 Chromium journeys before the launcher was
added. The launcher is built and opened interactively as part of this change.

## Exploratory review

The user can inspect the no-version preview checkpoint, exact draft fingerprints,
browser-evidence transition, immutable version receipt, separate publication review,
and controlled provider-confirmed publication in visible Chromium.

## Documentation

The root package exposes the launcher as `npm run demo:stage1`; the demo page contains
the suggested manual test and an explicit no-real-Google-changes notice.
