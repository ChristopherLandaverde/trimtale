# Generate confirmed form tracking setup

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/05-form-generation.md`

## Summary

Added semantic GTM import generation for practitioner-confirmed `generate_lead` form specifications and strengthened runtime validation of success-evidence contracts.

## Why

The conversational draft needs a deterministic, reviewable setup artifact without treating a submit attempt as conversion evidence or exposing submitted values.

## Behavior

Confirmed form specifications can generate evidence-specific GTM triggers and one GA4 event tag containing `form_id`, `form_name`, and `page_location`. Draft, incomplete, incompatible, malformed, and unsafe specifications are rejected. Generation does not import, publish, or claim platform confirmation.

## Regression coverage

`packages/core/src/form-generator.test.ts` covers all four supported evidence types, draft/incomplete/navigation/unsafe rejection, required parameters, privacy sentinels, trigger semantics, warnings, and generated metadata. Shared contract validation now rejects malformed success-evidence objects.

## Verification

`npm run verify` passed with valid change documentation, strict type checks, 52 deterministic tests, all workspace builds, and 20 Chromium workflows.

## Exploratory review

No exploratory Chromium review is applicable because this slice adds a deterministic generator with no new visible product surface. The generated artifact is protected through semantic assertions rather than brittle serialized snapshots.

## Documentation

Updated issue 05 and the accepted conversational tracking specification acceptance status.
