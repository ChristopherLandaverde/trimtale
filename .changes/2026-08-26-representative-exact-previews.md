# Prove representative exact previews

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/06-preview-repair-version.md`

## Summary

Add one permanent Chromium matrix that carries representative static, dynamic,
client-routed, and adversarial form pages through exact draft verification and
immutable version creation.

## Why

The supported exact-preview path was proven on two browser journeys but lacked a
regression showing that common rendering and routing variations use the same safe
workflow.

## Behavior

Supported product behavior is unchanged. The regression proves that delayed form
insertion, client-side success routing, and markup-bearing page labels do not require
special workflow branches. Each case binds evidence to the reviewed setup, workspace,
and preview fingerprints, excludes private and attacker-shaped values, creates one
immutable version, and does not publish. Real Tag Assistant interoperability remains
out of scope.

## Regression coverage

`tests/e2e/conversational-form.spec.ts` now runs the complete exact-preview version gate
against static, dynamic, client-routed, and adversarial pages. It asserts passing
evidence, the expected URL transition, exact fingerprints, immutable version creation,
no publication, and the privacy boundary.

## Verification

`npm run verify` passed preflight and documentation checks, all workspace typechecks,
411 deterministic tests across 51 files, all builds, and 70 Chromium journeys.

## Exploratory review

See `docs/reviews/2026-08-26-representative-exact-previews.md`. Headed Chromium covered
all four page types and retained page-plus-assistant captures. No unresolved finding
remains.

## Documentation

Updated Issue 06, the setup-engine acceptance checklist, and the Stage 1 handoff to
record the completed representative-fixture boundary and the remaining real-provider
interoperability gap.
