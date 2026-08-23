# Discover and confirm observed navigation target groups

Status: resolved

## Objective

Replace flat navigation-link scope with deterministic target groups and one confirmed
semantic navigation scope that distinguishes page regions and repeated destinations.

## Regression contract

- Core tests cover group validation, stable grouping, explicit inclusion/exclusion,
  duplicate URLs across header and footer, malformed groups, and no-target outcomes.
- Chromium tests show group-level choices, page highlights, correction, and the exact
  confirmed scope without silently selecting all links.
- Adversarial labels remain inert text and selectors never enter group summaries.

## Done when

- The extension presents meaningful groups and confirmation produces a valid scope.
- Existing form and navigation journeys remain green.

## Comments

- 2026-08-23: Implemented stable landmark groups, explicit include/exclude scope,
  group-level selection and highlights, duplicate header/footer destination coverage,
  and structural replacement of instruction-shaped labels. Full verification passes
  294 unit/API tests and 36 Chromium journeys; exploratory review has no unresolved
  findings.
