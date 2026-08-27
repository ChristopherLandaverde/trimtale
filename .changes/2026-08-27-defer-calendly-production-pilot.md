# Record the deferred Calendly production pilot

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/30-calendly-production-pilot.md`

## Summary

Separated the completed Calendly adapter from its deferred real-provider production
pilot and recorded the pilot's entry, evidence, authorization, failure, and cleanup
gates.

## Why

The user plans to return to the credentialed run later. A durable checklist prevents
local deterministic evidence from being mistaken for real Calendly, GTM, and GA4
interoperability evidence.

## Behavior

No runtime behavior changed. No booking, provider call, Google mutation, publication,
or cleanup was authorized or performed.

## Regression coverage

Not applicable: this change records an external validation gate without changing
production code or executable contracts.

## Verification

- `npm run check:change-docs`: 96 change records validated.
- `git diff --check`: passed.

## Exploratory review

Not applicable because no user-visible runtime behavior changed.

## Documentation

Added Issue 30 and linked it from the completed adapter issue and the ordered setup
optimization backlog.
