# Agent update-snapshots command

Change record version: 2

Issue: `.scratch/agent-command-harness/issues/02-update-e2e-snapshots-command.md`

## Summary

Added a closed `npm run agent -- update-snapshots` command for the sanctioned
Playwright visual-baseline update workflow.

## Why

The delivery harness documented a legitimate snapshot-update flow using a bare `npx`
command even though the agent harness intentionally excludes arbitrary package
execution. This keeps the workflow repeatable without widening the executable
surface.

## Behavior

`package.json` now exposes `test:e2e:update-snapshots`, which builds the repo and runs
Playwright with `--update-snapshots`. `scripts/agent-harness.mjs` maps
`update-snapshots` to that fixed npm script and still rejects all additional
arguments. The harness still does not expose dependency installation, arbitrary
`npx`, remote Git operations, destructive commands, or shell access.

## Regression coverage

- `scripts/agent-harness.test.ts` asserts every supported command maps to an exact
  invocation.
- A focused test verifies `update-snapshots` resolves to the fixed npm script and
  rejects extra arguments.
- The risky executable-surface regression continues to prove allowed commands use
  only `npm` or `git`, never `npx`.

## Verification

- `npm test -- scripts/agent-harness.test.ts` passed: 8 tests.
- `npm run verify` passed: preflight, change-documentation validation, strict
  TypeScript checks, 295 unit/domain tests, and 45 Playwright E2E workflows.

## Exploratory review

Interactive review is not applicable because this is a command-harness and
documentation-only workflow change with no product UI surface.

## Documentation

Updated README, `docs/engineering/delivery-harness.md`, and the agent command harness
issue tracker.
