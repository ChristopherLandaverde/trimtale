# Migrate navigation tracking to shared contracts

Status: resolved

Blocked by: 01

## Objective

Express the current navigation workflow as a confirmed tracking specification and normalized run evidence before introducing form behavior.

## Work

- Replace navigation-only proposal types with the versioned shared contract.
- Preserve current discovery, confirmation, generation, and evidence behavior.
- Convert the existing fixture and E2E path into the first scenario-corpus entry.

## Done when

- Existing navigation acceptance criteria remain satisfied.
- The navigation E2E test consumes the shared contracts.
- `npm run verify` passes.

## Comments

- 2026-08-22: Navigation setup proposals now carry a confirmed `TrackingSpecificationV1`. Navigation verdict evaluation emits normalized `TrackingRunEvidenceV1`, and E2E asserts the API contract without changing the floating-assistant workflow. `npm run verify` passed.

## Answer

The existing navigation path now consumes the shared contract foundation: generator scenarios assert the versioned specification, verdict tests assert normalized run evidence, and the complete browser workflow verifies the API response contract while preserving current UX.
