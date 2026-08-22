# Complete the automated conversational form journey

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/08-form-e2e.md`

## Summary

In progress: adds a reusable extension journey harness and deterministic explanation evaluation as the execution framework for the complete conversational form workflow.

## Why

Known user journeys should be verified automatically from visible chat through artifact, browser evidence, verdict, and explanation before exploratory review is needed to discover missing expectations.

## Behavior

The acceptance fixture now defines artifact semantics, required explanation concepts, and forbidden claims. A shared Playwright helper owns local extension launch and visible chat interaction. Explanation scoring accepts varied wording while rejecting missing diagnostic meaning and unsupported platform claims. Product generation and verification steps remain in progress on this draft branch.

## Regression coverage

Core tests cover complete, incomplete, and unsafe explanations. The acceptance-contract test requires explanation and artifact expectations for both passing and validation-error journeys. Existing browser and product regressions remain green.

## Verification

`npm run verify` passes at the harness-foundation checkpoint with 89 deterministic tests and 20 Chromium workflows.

## Exploratory review

Pending completion of the visible end-to-end workflow. Exploratory review will run after the automated journey passes and before issue resolution.

## Documentation

Updated the delivery harness, issue 08 regression contract, and its acceptance fixture.
