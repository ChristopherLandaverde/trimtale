# Extract setup operation presenter

Status: proposed

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

- [ ] Platform confirmation is always unavailable in presenter output.
- [ ] **Start browser verification** appears only for `published`.
- [ ] **Rollback <fingerprint>** appears only for `rollback_required`.
- [ ] `rolled_back` renders rollback completion without platform confirmation.
