# Complete the automated conversational form journey

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/08-form-e2e.md`

## Summary

Completes the acceptance-driven conversational form workflow from visible chat through confirmed setup, downloaded GTM import, browser verification, deterministic verdict, and plain-language explanation.

## Why

Known user journeys should be verified automatically from visible chat through artifact, browser evidence, verdict, and explanation before exploratory review is needed to discover missing expectations.

## Behavior

The acceptance fixture defines artifact semantics, required explanation concepts, and forbidden claims. A shared Playwright helper owns extension launch and visible chat interaction. After explicit confirmation, the assistant provides a reviewable `generate_lead` GTM import and a guided verification action. The successful fixture produces `browser_verified`; the validation fixture produces `expected_non_conversion`. Both preserve platform confirmation as `unverified`, and run evidence excludes submitted values.

The delivery harness now starts fresh local services by default and documents least-privilege command authorization. This prevents a stale development server from silently supplying completion evidence.

## Regression coverage

Core tests cover complete, incomplete, and unsafe explanations. The acceptance-contract test requires explanation and artifact expectations for both passing and validation-error journeys. The Playwright test consumes every acceptance journey, inspects the actual downloaded JSON, uses a private sentinel to guard artifact leakage, asserts visible target state and verdict boundaries, and retains final-state screenshots. Existing navigation, fixture, and visual regressions remain green.

## Verification

`npm run verify` passes with 89 deterministic tests and 22 Chromium workflows.

## Exploratory review

Passed in `docs/reviews/2026-08-22-conversational-form-e2e.md`. The review exercised successful and validation-error journeys, inspected final screenshots and the downloaded artifact, and remediated all discovered blocker/high findings before issue resolution.

## Documentation

Updated the delivery harness, issue 08 regression contract and resolution evidence, effort acceptance criteria, acceptance fixture, and exploratory review.
