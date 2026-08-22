# Protect the existing assistant UX baseline

Status: resolved

Blocked by: 02

## Objective

Make unintended visual and interaction changes to the existing floating assistant visible before conversational form work begins.

## Regression contract

Required test level: Chromium E2E visual and accessible-interaction assertions.

Behavioral test: `tests/e2e/navigation-extension.spec.ts`

Required baselines:

- Collapsed assistant.
- Open initial conversation.
- Navigation scope picker.
- Confirmed navigation evidence path.

Required invariants:

- The assistant remains collapsed on first mount and after reload when that preference was saved.
- Opening the assistant focuses the tracking-request composer.
- Existing accessible names for opening, collapsing, composing, sending, selecting scope, and viewing evidence remain available.
- Screenshot changes fail the ordinary E2E gate and require an intentional baseline update.

## Work

- Add stable locator screenshots with animations disabled.
- Keep the existing functional navigation journey as the source of visual states.
- Commit Linux Chromium baselines used by local and CI verification.
- Document the deliberate baseline-update command.

## Done when

- All required visual states have committed baselines.
- Interaction and focus invariants are asserted.
- Failure diffs remain available under `test-results/` and in CI artifacts.
- `npm run verify` passes.

## Comments

- 2026-08-22: Added and visually reviewed four Linux Chromium baselines. The existing E2E now asserts composer focus, accessible roles/names, collapse persistence, and normal screenshot comparison. `npm run verify` passed with 22 unit/scenario/acceptance-contract tests and the Chromium E2E test.
- 2026-08-22: CI exposed host-specific system-font anti-aliasing in 1,132 pixels of the open-state image. Downloaded expected/actual/diff artifacts showed identical layout and controls with differences limited to glyph edges. Added a 2% pixel ceiling while keeping semantic and interaction assertions exact.

## Answer

The current floating assistant UX is protected at the collapsed, open, navigation-scope, and confirmed-evidence states. Intentional changes require an explicit snapshot update and review; unintended visual changes fail the ordinary completion gate with diff artifacts.
