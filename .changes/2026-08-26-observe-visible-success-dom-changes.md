# Observe visible success DOM changes

Change record version: 2

Issues: `.scratch/gtm-setup-engine/issues/19-observe-visible-success-dom-changes.md`,
`.scratch/gtm-setup-engine/issues/20-preserve-verified-preview-version.md`

## Summary

Emit GTM's canonical Element Visibility parameters and preserve the verified preview
during immutable version creation.

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
unchanged. Exact-policy version creation rechecks managed state without creating a
second quick preview. Any detected drift clears the stale browser evidence.

## Regression coverage

`packages/core/src/form-generator.test.ts` rejects the ignored aliases and requires
the complete canonical parameter set, including DOM-change observation.
`apps/api/src/google-validation-version.test.ts` proves version creation preserves the
verified preview, while `apps/api/src/workflow-runner.test.ts` proves drift invalidates
the bound evidence.

## Verification

`npm run verify` passes with 420 deterministic tests across 51 files and 71 Chromium
journeys. The focused headed adversarial journey also passes.

## Exploratory review

The first real rerun proved provider validation alone was insufficient: Google stored
the aliases, but its rendered editor showed an empty ID selector. The canonical rerun
then emitted `gtm.elementVisibility`, fired `GA4 Event - generate_lead`, and bound exact
browser evidence. The review is recorded under
`docs/reviews/2026-08-26-canonical-visible-success-trigger.md`. The corrected version
gate then created immutable GTM version `5` without rotating that evidence.

## Documentation

Issues 19 and 20 record the real failures and their bounded corrections.
