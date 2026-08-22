# Show real generated setup evidence

Change record version: 2

Issue: `.scratch/managed-gtm-workspace/issues/02-generated-setup-evidence.md`

## Summary

Generates a real reviewable GTM setup after navigation or lead-form confirmation, marks setup generation passed only when the artifact exists, and provides a navigation artifact download.

## Why

The managed-workspace demo could prepare an empty workspace while still saying no setup had been generated. A setup must exist before later application and verification stages can be meaningful.

## Behavior

Confirmed navigation creates a `navigation_click` container file and download; confirmed lead forms expose their existing `generate_lead` artifact as generated. Missing measurement or container context remains pending. Generated guidance now targets the recognized managed workspace or an existing review workspace instead of instructing one new workspace per setup. Downloading does not claim application or publication.

## Regression coverage

Generator tests protect managed-workspace guidance. Chromium parses the real navigation download and asserts one tag, one trigger, the expected filename, and no application/publication claim. Existing lead-form success, validation, container recognition, managed-workspace, target-safety, and visual workflows remain covered. Two intentional visual baselines now include passed generation and the download control.

## Verification

`npm run verify` passed with valid change documentation, strict TypeScript checks, 114 deterministic tests in the current workspace, all workspace builds, and 25 Chromium workflows.

## Exploratory review

`docs/reviews/2026-08-22-generated-setup-evidence.md` records the agent-owned Chromium review. No blocker or high-severity findings remain.

## Documentation

Added issue 02, extended the accepted managed-workspace specification, and recorded the new user-visible evidence state. Existing glossary terms remain sufficient; no ADR is needed.
