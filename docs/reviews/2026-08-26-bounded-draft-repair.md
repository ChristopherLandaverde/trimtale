# Bounded exact-draft repair review

Date: 2026-08-26

## Environment

- Built production extension in headed managed Chromium.
- Local deterministic API, fixture site, and verification target.
- Controlled failed preview, repair plan, application, and provider-validation
  responses.
- No real Google workspace mutation.

## Scenarios

1. Applied and validated a lead-form setup, ran its exact preview with no matching GA4
   request, and reviewed one product-owned tag update as repair 1 of 2.
2. Confirmed the repair, observed new workspace and GTM preview fingerprints, and
   verified that no immutable version existed before the new browser run.
3. Exercised the runner's no-known-repair response and maximum-attempt behavior.
4. Submitted a private form value and attached attacker-shaped page data during the
   failed run.

## Observations

- Failed evidence retains the old setup, workspace, and preview fingerprints.
- The concrete update and attempt budget appear before repair approval; no repair
  request is applied before that approval.
- The repair keeps the same setup fingerprint and returns `workspace-repaired` and
  `preview-9` after provider validation.
- Versioning and publication remain unavailable until a new exact preview passes.
- The private form value and attacker-shaped data are absent from the repair request
  and visible task state.

## Findings

- Fixed during review: the repair plan and refreshed binding were originally appended
  after their action controls and could fall below the composer. Both receipts now
  precede their actions, and the journey asserts they can enter the viewport.
- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- `npm run verify`: 411 deterministic tests and 64 Chromium journeys passed.
- Headed focused review: the repair journey passed.
- Captures: `bounded-draft-repair-review.png` and
  `bounded-draft-repair-preview.png` under the focused Playwright result directory.
