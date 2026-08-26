# Show every grounded tracking target

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/37-visible-target-certainty.md`

## Summary

Show confirmed page highlights for automatically resolved forms and local-only
candidate/confirmed markers for known link interactions.

## Why

Practitioners need visual proof that the website agent grounded their request in the
intended page element before they review or approve setup.

## Behavior

Single forms selected by deterministic intake are highlighted immediately. Phone,
email, outbound, and download requests highlight locally matching links while scope is
open and confirm the markers after scope selection. Generic labels are rendered on the
page; selectors, destinations, contact values, and visible text do not cross the
extension boundary. Automatic scrolling, CTA selection, setup semantics, long-card
layout, correction controls, copy, and task restoration remain unchanged.

## Regression coverage

Built-extension tests cover an automatically resolved single form, all four known-link
categories, candidate-to-confirmed scope transition, exact matching, and the absence
of attacker-shaped or contact values in agent state. Existing multiple-form visual
contracts remain intact.

## Verification

`npm run verify` passes 404 deterministic tests across 51 files and 61 Chromium
journeys. All builds, workspace typechecks, preflight checks, and 68 change records
pass. The connected-evidence visual surface is pinned to its reviewed width after the
full gate exposed a one-pixel test-only drift; the reviewed baseline passed five fresh
Chromium repetitions.

## Exploratory review

See `docs/reviews/2026-08-25-visible-target-certainty.md`. Single-form, four known-link,
scope transition, and attacker-shaped scenarios were visually inspected. No blocker
or high-severity finding remains; a compact receipt-layout issue is recorded as a
separate UX follow-up.

## Documentation

Updated the setup-engine specification, implementation issue, current capabilities,
Stage 1 handoff, exploratory review, and receipt-layout follow-up. Existing domain
terms were sufficient, so no glossary entry or ADR was added.
