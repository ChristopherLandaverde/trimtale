# Add bounded model-backed setup authoring

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/04-model-authoring-suggestions.md`

## Summary

Add one privacy-filtered, schema-constrained authoring call that proposes a generic
GTM and GA4 setup plus visible parameter classifications.

## Why

Natural language should shorten setup time without allowing model output to invent
page grounding, evidence, provider authority, or approval.

## Behavior

The authoring boundary accepts only supplied firing-policy and value candidate IDs,
classifies required, recommended, custom-definition, unavailable, clarification, and
prohibited suggestions, and assembles a draft through deterministic grounding. The
OpenAI adapter is deployment-configured, uses strict structured output, disables
storage, exposes token and estimated-cost accounting, and has a protected backend
endpoint that remains off unless explicitly enabled.

## Regression coverage

`tests/fixtures/setup-authoring-corpus-v1.json`,
`packages/core/src/setup-authoring.test.ts`, and
`apps/api/src/openai-setup-authoring-provider.test.ts` cover ordinary, ambiguous,
unsupported, privacy, authority-escalation, malformed-response, and cost boundaries.

## Verification

`npm run verify` passes 369 unit tests and 51 Playwright Chromium journeys.

## Exploratory review

Not applicable. This change adds an internal authoring boundary and inactive provider
adapter without changing the visible extension workflow.

## Documentation

The Stage 1 acceptance checklist and authoring issue record the completed boundary.
