# Generate confirmed form tracking setup

Status: open

Blocked by: 01, 03

## Objective

Generate an ordinary, reviewable GTM import configuration for a confirmed `generate_lead` specification.

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
