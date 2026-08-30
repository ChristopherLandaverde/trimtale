# Require exploratory Chromium review

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/11-exploratory-intake-findings.md`

## Summary

Adds an agent-owned exploratory Chromium review gate and records the first review findings for conversation intake.

## Why

Automated tests preserved the assertions they encoded but did not reveal missing form highlights or misleading GTM evidence language. User-visible completion requires direct review of the built workflow.

## Behavior

Product behavior is unchanged in this process slice. User-visible issues may no longer resolve or become review-ready with unresolved blocker/high exploratory findings.

## Regression coverage

Change-record validation now requires version-2 records changed by a PR to contain an exploratory-review section. Confirmed product findings are captured in issue 11 with required permanent test coverage for their remediation.

## Verification

`npm run verify` is required before completion.

## Exploratory review

Review report: `docs/reviews/2026-08-22-conversation-intake.md`.

The navigation and form-intake workflows were exercised in Chromium. Two high-severity findings remain and are claimed in issue 11; this process change documents them but does not claim to resolve the product behavior.

## Documentation

Updated agent instructions, delivery guidance, change-record and pull-request templates, validation rules, the exploratory review report, and remediation issue 11.
