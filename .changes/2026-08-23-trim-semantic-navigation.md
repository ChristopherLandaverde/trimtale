# Trim semantic navigation infrastructure

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/26-trim-semantic-navigation.md`

## Summary

Navigation tracking returns to direct practitioner selection. Semantic grouping, local
Ollama routing, its evaluation corpus, and automatic target preview are removed.

## Why

The subsystem was built from an example used to explore agent decisions and did not
advance the lead-form MVP enough to justify its runtime and maintenance cost.

## Behavior

- Basic navigation discovery, selection, GTM setup generation, download, managed
  workspace preparation, and browser verification remain.
- Navigation interpretation is deterministic.
- No navigation-specific model endpoint, model command, group contract, or preview
  keyboard workflow remains.
- Lead-form planning, connected GA4 evidence, and the agent workbench are unchanged.

## Regression coverage

The retained generator tests and built-extension navigation journey cover direct
selection, artifact generation, download, workspace preparation, browser evidence,
and attacker-shaped text. Removed tests exercised only removed behavior.

## Verification

`npm run verify` passed local preflight, 41 change records, strict checks and builds,
273 deterministic tests across 39 files, and all 38 Chromium journeys. The focused
navigation generator passed 4 tests; the focused built-extension journey passed all 5
paths after intentional visual-baseline review.

## Exploratory review

[`docs/reviews/2026-08-23-trim-semantic-navigation.md`](../docs/reviews/2026-08-23-trim-semantic-navigation.md)
records direct selection, missing context, hostile page text, managed-workspace
preparation, and visual inspection. No blocker or high-severity finding remains.

## Documentation

The glossary, README, current capabilities, MVP handoff, historical roadmap, issue 26,
and this record describe the reduced boundary.
