# Observe visible success DOM changes

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/19-observe-visible-success-dom-changes.md`

## Summary

Emit GTM's canonical Element Visibility trigger parameters and enable DOM-change
observation.

## Why

The real Stage 1 preview revealed the success element after form submission, but the
generated trigger used provider-accepted parameter aliases that GTM's runtime ignored.
The trigger defaulted to an empty ID selector, so the approved `generate_lead` tag did
not fire.

## Behavior

Visible-element success evidence now compiles with GTM's canonical
`elementSelector`, `selectorType`, `onScreenRatio`, `useOnScreenDuration`,
`useDomChangeListener`, and `firingFrequency` parameters. Other trigger types,
selectors, intent, data handling, provider authority, and publication gates remain
unchanged.

## Regression coverage

`packages/core/src/form-generator.test.ts` rejects the ignored aliases and requires
the complete canonical parameter set, including DOM-change observation. Existing
compiler and semantic-planning suites cover unchanged surrounding behavior.

## Verification

`npm run verify` passes with 419 deterministic tests across 51 files and 71 Chromium
journeys. The focused headed adversarial journey also passes.

## Exploratory review

The first real rerun proved provider validation alone was insufficient: Google stored
the aliases, but its rendered editor showed an empty ID selector. The canonical rerun
then emitted `gtm.elementVisibility`, fired `GA4 Event - generate_lead`, and bound exact
browser evidence. The review is recorded under
`docs/reviews/2026-08-26-canonical-visible-success-trigger.md`; Issue 20 owns the
separate version-gate finding.

## Documentation

Issue 19 records the real failed evidence and bounded compiler correction.
