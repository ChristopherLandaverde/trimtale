# Require exact Preview readiness

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/24-exact-preview-readiness.md`

## Summary

Exact draft browser runs now remain locked behind a visible readiness receipt until
the recognized container is loaded on the bound target and the practitioner confirms
that Tag Assistant shows that target as Connected.

## Why

A validated GTM quick preview, an open Tag Assistant tab, a loaded page container, and
a Connected browser target are separate facts. The prior handoff displayed the durable
Preview binding but enabled a browser run without recording the supported human part
of that boundary.

## Behavior

The receipt displays the recognized and loaded container, managed workspace, bound
Preview fingerprint, connected target, and confirmation state. A confirmation is held
only in extension memory and bound to the durable operation, workspace, Preview
fingerprint, container, and normalized page URL. A local mismatch blocks confirmation;
rechecking does not mutate GTM or create another workflow request.

The agent does not inspect Google cookies, infer connection from an optional debug
parameter, automate Google sign-in, or call an undocumented Tag Assistant interface.

## Regression coverage

`tests/e2e/conversational-form.spec.ts` proves that the run action is absent before
confirmation, target drift blocks confirmation without another workflow request, and
returning to the bound target requires a fresh confirmation. Existing exact form,
repair, restart, publication, and adversarial journeys now cross the same gate.
`tests/e2e/conversation-intake.spec.ts` proves the shared known-interaction path does
the same for an exact phone-click workflow.

## Verification

- Focused readiness, restart, and phone-click journeys: passed.
- Both affected Chromium suites: 24 journeys passed.
- `npm run verify`: 421 deterministic tests and 75 Chromium journeys passed.

## Exploratory review

See `docs/reviews/2026-08-27-exact-preview-readiness.md`.

## Documentation

Updated the supported Preview handoff ADR, active setup-engine specification, current
capabilities, and Issue 24.
