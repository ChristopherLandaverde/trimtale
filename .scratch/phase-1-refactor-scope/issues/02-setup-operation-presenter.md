# Extract setup operation presenter

Status: resolved

## Problem

`renderSetupOperation` mixes operation-state interpretation, product copy, timeline
row construction, DOM rendering, and action wiring. This is the easiest place to
accidentally overclaim platform confirmation or hide rollback actions.

## Regression Contract

- Extract a pure presenter for setup-operation labels, guidance, timeline rows, and
  action descriptors.
- Add unit coverage for `published`, `completed`, `rollback_required`, and
  `rolled_back`.
- Run targeted extension E2E for publication, browser verification, and rollback.
- Run `npm run verify` before resolving.

## Acceptance Criteria

- [x] Platform confirmation is always unavailable in presenter output.
- [x] **Start browser verification** appears only for `published`.
- [x] **Rollback <fingerprint>** appears only for `rollback_required`.
- [x] `rolled_back` renders rollback completion without platform confirmation.

## Resolution Notes

- Added `apps/extension/src/setup-operation-presenter.ts` as the pure presenter for
  setup-operation labels, guidance, timeline rows, assistant copy, and action
  descriptors.
- Updated `apps/extension/src/content-script.ts` so DOM rendering consumes presenter
  output and wires the returned action descriptors to existing workflow commands.
- Added `apps/extension/src/setup-operation-presenter.test.ts` covering versioned,
  published, completed, rollback-required, rolled-back, and paused/blocked action
  visibility.
