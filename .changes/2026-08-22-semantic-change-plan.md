# Build the read-only tracking change plan

Change record version: 2

Issue: `.scratch/workflow-automation/issues/02-semantic-change-plan.md`

## Summary

Added a deterministic planner that compares generated navigation and lead-form setups
with freshly read managed-workspace entities without mutating GTM.

## Why

Idempotent application requires a reviewable create, reuse, no-op, or conflict decision
that is independent of GTM-assigned identifiers and safe to recompute after interruption.

## Behavior

The core planner canonicalizes supported tags, triggers, custom variables, and built-in
variables, including trigger-reference translation across GTM IDs. Same-name semantic
differences and multiple equivalents fail the plan closed. The Google client validates
container identity, requires the marked managed workspace, lists its entity collections,
and returns the plan using read-only calls.

No workspace preparation, entity write, validation, version creation, or publication is
newly supported.

## Regression coverage

`packages/core/src/change-plan.test.ts` covers navigation and lead-form creation, exact
no-ops, semantic reuse with different GTM IDs and storage metadata, partial creation,
name collision, ambiguous equivalence, and stable ordering/fingerprints.
`apps/api/src/google.test.ts` proves fresh managed-workspace entity reads, no mutation,
workspace-required behavior, and trigger-reference reuse through the Google client.

## Verification

The focused core and Google-client contract passed 22 tests. `npm run agent -- verify`
passed local preflight, change-documentation and TypeScript checks, all 134 deterministic
tests, every workspace build, and all 25 Chromium workflows.

## Exploratory review

Not applicable. This is a read-only domain and Google-client foundation with no new
built-product control or visible workflow.

## Documentation

Added the tracking-change-plan engineering contract and advanced the resumable workflow
automation specification.
