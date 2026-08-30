# Generate confirmed form tracking setup

Status: resolved

Blocked by: 01, 03

## Objective

Generate an ordinary, reviewable GTM import configuration for a confirmed `generate_lead` specification.

## Regression contract

Required test level: deterministic semantic generator tests under `npm test`.

Behavioral test: `packages/core/src/form-generator.test.ts`

Required invariants:

- Draft, incomplete, navigation, and unsafe form specifications are rejected.
- Each supported success-evidence type produces a trigger limited to the confirmed evidence.
- Generated tags contain `form_id`, `form_name`, and `page_location` but no submitted field values.
- Output requires Merge/new-workspace review and never claims platform confirmation or publishes.

## Work

- Add form-specific variables, trigger conditions, and GA4 event configuration.
- Require confirmed success evidence rather than a generic button click.
- Include required parameters without exposing submitted values.
- Keep Merge/new-workspace instructions and preflight warnings.

## Done when

- Draft or incomplete specifications are rejected.
- Generated entities are limited to confirmed targets and evidence conditions.
- Generator tests cover supported evidence types and unsafe inputs.
- No output claims platform confirmation.
- `npm run verify` passes.

## Comments

- 2026-08-22: Added evidence-specific GTM trigger generation for visible elements, thank-you URLs, data-layer events, and same-page success signals. Generator and shared-contract regressions reject draft, incomplete, incompatible, malformed, and unsafe inputs and prove submitted values cannot enter the container artifact.

## Answer

A practitioner-confirmed `generate_lead` specification now produces an ordinary GTM export with confirmed success triggers, required non-sensitive form metadata, Merge/new-workspace instructions, and explicit browser/platform boundaries. Generation never imports or publishes the setup.
