# Preserve long-review context

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/36-long-review-scroll-context.md`

## Summary

Position long in-place task updates at their beginning so the compact workbench keeps
review context visible.

## Why

Bottom anchoring could open a tall review below its heading, forcing the practitioner
to scroll backward before understanding the decision.

## Behavior

Tasks taller than the message viewport open at their beginning. Their existing actions
remain reachable through the overlay scroll area. Short messages, overlay sizing,
review content, setup semantics, and approval authority are unchanged.

## Regression coverage

The email-link Chromium journey protects initial heading visibility and access to the
unchanged setup-approval action within the compact overlay.

## Verification

`npm run verify` passes 404 deterministic tests across 51 files and 61 Chromium
journeys. All builds, workspace typechecks, preflight checks, and 70 change records
pass.

## Exploratory review

See `docs/reviews/2026-08-25-long-review-context.md`. Long review, blocked no-target,
attacker-shaped page content, and action-reachability scenarios were inspected with no
unresolved blocker or high-severity finding.

## Documentation

Updated the conversational specification and implementation issue. Existing domain
terms were sufficient, so no glossary entry or ADR was added.
