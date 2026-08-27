# Preserve the verified preview during versioning

Delivery mode: implementation
Status: resolved

## Production outcome

Immutable version creation after exact browser verification rechecks the bound
workspace and managed entities without creating a new GTM quick preview or changing
the verified preview fingerprint.

## Non-goals

- Weakening workspace, entity, setup, or browser-evidence binding.
- Reusing evidence after any managed workspace change.
- Approving or publishing the created version.

## Authorization

The user authorized continuous Stage 1 implementation through exact version review.
Issue 19's successful real browser run exposed this defect at the required version
gate.

## Regression contract

`apps/api/src/google-validation-version.test.ts` proves exact-policy version creation
does not call `quick_preview` again and still blocks changed workspace or managed
entity state before `create_version`.

## Progress

- 2026-08-26: Exact browser evidence passed for setup `setup_c8ba6ac7eef7` and preview
  `1787793264804`; Tag Assistant fired the managed tag once.
- 2026-08-26: Version creation called `quick_preview` during fresh validation. Google
  returned a new fingerprint for unchanged draft state, invalidating the exact binding
  and leaving the operation safely at `draft_verified`. No version or publication was
  created.
- 2026-08-26: Version creation now rechecks the bound workspace and managed entities
  without rotating the verified preview. Managed-state drift clears the stale browser
  evidence and returns the operation to `validation_failed`.
- 2026-08-26: The full verification gate passed with 420 deterministic tests across
  51 files and 71 Chromium journeys. The credentialed operation then created immutable
  version `5` from preview `1787793264804`; publication remained gated.
