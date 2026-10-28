# Block silent managed replacement

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/30-block-silent-managed-replacement.md`

## Summary

Same-name managed semantic changes now stop at plan review instead of becoming
automatic updates. The workbench names the replacement boundary and cannot apply the
blocked plan.

## Why

An approved setup must not silently replace a previously managed success signal.

## Behavior

- Create, exact reuse, semantic reuse, and no-op behavior remain supported.
- A differing same-name managed entity becomes
  `managed_change_requires_approval` with its existing entity ID.
- The extension passes only that bounded reason, displays an explicit replacement
  message, and offers no apply action.
- Explicit replacement, deletion, and publication remain out of scope.

## Regression coverage

Planner regressions cover destination and success-trigger changes. The API regression
proves no provider call or write. The built-extension regression proves the visible
block, absent apply action, and absent resume request.

## Verification

- The new planner and API regressions failed before implementation and passed after it.
- The new Chromium regression failed before implementation and passed after it.
- `npm run verify` passed 278 deterministic tests across 40 files and 44 Chromium
  journeys.

## Exploratory review

[Managed replacement safety review](../docs/reviews/2026-08-23-block-silent-managed-replacement.md)
covered ready, conflicting, and authority-escalating states. Its one medium visual
finding was fixed and regressed; no finding remains.

## Documentation

The accepted specification records the fail-closed acceptance criterion. Issue 30 and
the exploratory review preserve the live finding and result.
