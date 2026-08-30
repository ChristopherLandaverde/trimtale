# Build the read-only tracking change plan

Status: resolved

Blocked by: 01

## Objective

Compare a generated tracking setup with freshly read container and managed-workspace
entities and produce deterministic create, reuse, no-op, or conflict actions without
mutating GTM.

## Regression contract

Cover empty, identical, semantically equivalent with different IDs, partial, conflicting,
navigation, and lead-form setups. Repeated planning over equivalent normalized inputs
must return the same plan and fingerprint.

## Comments

- 2026-08-22: Claimed after delivery preflight merged. The planner will compare
  supported generated tags, triggers, custom variables, and built-in variables by
  canonical semantics, translate trigger references across GTM IDs, and treat name
  collisions or multiple equivalent targets as conflicts.
- 2026-08-22: The focused core and Google-client contract passed 22 tests. The full
  `npm run agent -- verify` gate passed local preflight, 134 deterministic tests,
  every workspace build, and all 25 Chromium workflows. Google client coverage proves
  planning uses only fresh GET requests and stops before entity reads when workspace
  preparation is still required.

## Answer

Generated navigation and lead-form setups now produce deterministic read-only tracking
change plans against the marked managed workspace. GTM-assigned IDs and storage
metadata do not hide semantic reuse, while name collisions, duplicates, container
mismatch, and unavailable workspaces stop the workflow before mutation.
