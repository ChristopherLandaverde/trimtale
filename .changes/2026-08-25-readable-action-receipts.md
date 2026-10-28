# Keep compact action receipts readable

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/38-readable-action-receipts.md`

## Summary

Reserve readable label space in compact action receipts while wrapping long evidence
details within the remaining row width.

## Why

Page-discovery details can contain several counts and previously squeezed the receipt
label into a vertical sequence of characters.

## Behavior

Receipt labels and details remain side by side with bounded, wrapping columns. Receipt
values, privacy filtering, evidence meaning, overlay size, and other evidence cards are
unchanged.

## Regression coverage

The known-link Chromium journey protects label readability, contained detail wrapping,
and the absence of horizontal task overflow with several page interaction counts. The
reviewed automatic-coverage task baseline now records the intentional receipt reflow;
the connected-evidence baseline received only its stable 91-pixel glyph-rendering
update after expected, actual, and diff inspection plus three identical runs.

## Verification

`npm run verify` passes 404 deterministic tests across 51 files and 61 Chromium
journeys. All builds, workspace typechecks, preflight checks, and 70 change records
pass.

## Exploratory review

See `docs/reviews/2026-08-25-readable-action-receipts.md`. Multi-count, connected-
context, page-marker, and attacker-shaped link scenarios were inspected with no
unresolved blocker or high-severity finding.

## Documentation

Updated the conversational specification and implementation issue. Existing domain
terms were sufficient, so no glossary entry or ADR was added.
