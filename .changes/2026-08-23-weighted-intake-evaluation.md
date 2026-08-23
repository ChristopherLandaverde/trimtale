# Add weighted intake evaluation outcomes

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/15-weighted-intake-evaluation.md`

## Summary

Validated intake shadow records now produce explicit semantic pass, fail, hard-failure,
or inconclusive outcomes and complete provider summaries with weighted accuracy,
safety, latency, and usage evidence.

## Why

Runtime schema acceptance proves that output is safe to inspect, not that it matches the
expected tracking intent. Model comparison needs deterministic semantic outcomes before
real providers or paid calls are introduced.

## Behavior

A case passes only at 100 points across the fixed 25/25/20/15/15 dimensions. Valid but
incorrect output fails with its partial score. Rejected output, private-sentinel
disclosure, and omitted required confirmation hard-fail regardless of other points;
provider errors and timeouts are inconclusive with zero points.

Provider summaries require exactly one record per corpus case and report outcome counts,
average score, latency percentiles, bounded token and cost totals, and usage coverage.
This slice runs no real model, adds no SDK, prompt, credential, persistence, API route,
visible behavior, GTM mutation, or publication behavior.

## Regression coverage

`packages/core/src/intake-evaluation.test.ts` protects perfect and reworded passes,
partial semantic failure, three hard-failure paths, provider error and timeout outcomes,
two-provider aggregation, complete corpus coverage, baseline integrity, duplicate and
missing record rejection, and runtime score and summary consistency.

## Verification

Focused intake contract, shadow, and evaluation coverage passed 18 tests across 3
files, and core strict TypeScript checking passed. `npm run verify` passed
change-documentation and strict TypeScript checks, every workspace build, all 223
deterministic tests across 33 files, and all 26 Chromium workflows.

## Exploratory review

Not applicable. This is a deterministic offline evaluator with no real provider call,
API endpoint, persistence, or user-visible browser behavior.

## Documentation

The conversational tracking specification and intake interpretation engineering guide
document semantic outcomes, weights, hard failures, and aggregate evidence. Current
capabilities and the roadmap distinguish the completed evaluator from the still-pending
authorized provider comparison.
