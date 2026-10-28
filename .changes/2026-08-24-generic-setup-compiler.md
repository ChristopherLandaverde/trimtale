# Compile generic GTM setup graphs

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/02-gtm-entity-graph.md`

## Summary

Compile confirmed generic setups into dependency-ordered GTM tags, triggers, built-in
variables, data-layer variables, constants, template fields, and Custom HTML entities.

## Why

The setup engine needs one deterministic path from open configuration data to an
artifact the existing semantic change planner can review.

## Behavior

The compiler supports the Stage 1 trigger primitives, condition grouping, blocking
triggers, consent requirements, firing frequency, structured template fields, and
deterministic entity references. Language interpretation, provider mutation, and
publication remain out of scope.

## Regression coverage

`packages/core/src/setup-compiler.test.ts` covers unrelated event fixtures, include
and exclusion conditions, consent, dependency order, variable deduplication, malformed
references, and semantic reuse after GTM identifiers change.

## Verification

`npm run verify` passes 326 unit tests and 51 Playwright Chromium journeys.

## Exploratory review

Not applicable. This slice adds an internal compiler without a new visible workflow.

## Documentation

The compiler issue records the concrete regression files and resolution evidence.
