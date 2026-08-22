# Add conversational tracking plan and delivery harness

Issue: `.scratch/conversational-tracking-specs/spec.md`

## Summary

Defined the conversational tracking-specification effort, added versioned shared contracts, migrated the navigation setup/evidence path, and added an enforceable delivery process for change records, regression coverage, repository verification, and pull-request documentation.

## Why

Form tracking and future intelligence need reusable contracts and permanent regression protection so incremental delivery can continue without silently reversing accepted behavior.

## Behavior

The user-facing product behavior is unchanged. Navigation setup proposals now include a confirmed tracking specification and navigation verdicts expose normalized run evidence. The planning model distinguishes conversation intake, tracking specifications, run evidence, deterministic verdicts, and verified resolutions. Code-bearing pull requests are required to carry a structured change record.

## Regression coverage

The repository verification gate now validates change-record structure. Pull-request CI additionally checks that code-bearing diffs include a change record. Contract tests cover round trips, schema versions, invalid event combinations, form success evidence, scenarios, and run-evidence envelopes. Existing generator, verdict, and browser E2E coverage asserts the migrated navigation contract. Issue 08 now has a schema-validated positive and negative acceptance fixture that must become the input to its eventual browser test.

## Verification

`npm run verify` passes: strict TypeScript checks, 19 unit/scenario tests, builds, and one Chromium extension E2E test.

## Documentation

Added the conversational tracking specification, nine implementation issues, domain glossary terms, delivery-harness guidance, change-record guidance, and a pull-request template.
