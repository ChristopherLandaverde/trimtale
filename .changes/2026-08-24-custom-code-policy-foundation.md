# Add Custom HTML safety and review foundation

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/05-custom-code-authoring.md`

## Summary

Add a vendor-neutral Custom HTML proposal, static safety policy, exact review receipt,
and generic compiler path.

## Why

Third-party JavaScript is an MVP capability, but arbitrary or opaque code must not
bypass privacy, consent, destination, scope, or verification review.

## Behavior

Proposals disclose authoritative-source metadata, exact code, network destinations,
inputs, consent, firing scope, and positive and negative expectations. Static checks
reject private browser data, dynamic execution, dynamic or undeclared destinations,
unsafe selectors, and malformed generic policies. The setup remains a draft and uses
the ordinary generic compiler.

## Regression coverage

`packages/core/src/custom-code.test.ts` covers review fingerprints, compiler output,
private-data sources, dynamic execution, destination declarations, and firing scope.

## Verification

`npm run verify` passes 369 unit tests and 51 Playwright Chromium journeys.

## Exploratory review

Not yet applicable. A real authoritative vendor and visible browser journey remain an
open product choice in Issue 05.

## Documentation

Issue 05 remains in progress until a real vendor example passes the ordinary browser,
version, approval, and publication workflow.
