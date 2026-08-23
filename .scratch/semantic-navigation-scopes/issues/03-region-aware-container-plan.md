# Compile region-aware setup against a container inventory

Status: resolved

## Objective

Compile confirmed navigation scopes into reusable GTM entities and plan them through a
normalized inventory that remains deterministic with large existing workspaces.

## Regression contract

- Generator tests prove the same URL in header and footer fires only for the confirmed
  region and includes `navigation_area` without personal data.
- Change-plan tests cover 200 unrelated entities, semantic reuse, managed updates,
  name collisions, ambiguous equivalents, deterministic ordering, and stable
  fingerprints.
- End-to-end coverage verifies the reviewable scope, generated artifact, and no-write
  boundary before the existing approval checkpoint.

## Done when

- One confirmed semantic scope compiles to a minimal reusable setup.
- Large unrelated inventories do not change the plan or enter model input.

## Comments

- 2026-08-23: Added URL-plus-CSS-selector trigger scope, one reusable
  `navigation_area` variable, Click Element dependency, semantic scope persistence in
  generated specifications, and indexed inventory planning. The 200-tag regression,
  Google payload normalization, idempotent second application, downloaded artifact,
  and full completion gate pass.
