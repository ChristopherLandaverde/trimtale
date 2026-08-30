# Automate delivery and integration readiness

Status: resolved

## Objective

Make routine readiness deterministic and remove duplicate pull-request verification
without moving credentialed Google operations into the ordinary agent harness.

## Regression contract

Required test level: deterministic tests under `npm test`.

Behavioral tests:

- `scripts/workflow-preflight.test.ts`
- `scripts/ci-policy.test.ts`
- `scripts/agent-harness.test.ts`

Required invariants:

- Local readiness checks supported Node/npm versions, lockfile, installed dependencies,
  required scripts, and the managed Chromium binary.
- Google readiness checks OAuth variables, callback shape, exact extension origin, and
  explicit container-write enablement without rendering secret values.
- Google readiness remains a separate explicitly invoked command and is absent from
  ordinary `verify`.
- The allowlisted agent harness exposes only the non-credentialed local preflight.
- CI verifies pull requests once, cancels obsolete runs, and verifies merged `main`.

## Done when

- The regression contract passes in `npm test`.
- `npm run agent -- preflight` passes locally and runs inside ordinary `verify`.
- `npm run preflight:google` reports readiness without printing credential values.
- The GitHub workflow no longer launches both push and pull-request jobs for one PR
  commit.
- `npm run verify` passes.

## Comments

- 2026-08-22: Claimed. Credentialed readiness stays outside `npm run agent`; this keeps
  the existing authorization boundary while still making missing configuration
  deterministic before a live integration run.
- 2026-08-22: Local and fake-config Google preflights passed without printing values.
  The focused regression contract passed 13 tests. `npm run agent -- verify` then
  passed the new preflight, 124 deterministic tests, every workspace build, and all
  25 Chromium workflows.

## Answer

Readiness failures now surface before the expensive verification and integration
steps. Pull requests receive one current CI run, obsolete runs cancel, merged `main`
is verified again, and credentialed configuration remains explicit and redacted.
