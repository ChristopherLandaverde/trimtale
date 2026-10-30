# Agent commit command

Change record version: 2

Issue: `.scratch/agent-command-harness/issues/03-closed-commit-command.md`

## Summary

Added a guarded `npm run agent -- commit` command that commits only already-staged
changes using the fixed message file `.scratch/commit-message.md`.

## Why

Routine delivery work needs repeatable commits without opening a broad Git or shell
surface. The command removes a common stop point while preserving explicit review at
the staging and push boundaries.

## Behavior

The agent harness now supports `commit`. It refuses to run when the fixed message file
is missing or empty, when the current branch is `main`, or when nothing is staged. On
success it deletes `.scratch/commit-message.md`. The harness still rejects extra
arguments, does not stage files, does not push, and does not expose destructive Git
operations.

## Regression coverage

- `scripts/agent-harness.test.ts` verifies the exact command mapping and argument
  rejection.
- Harness tests cover missing and empty commit-message files, main-branch refusal,
  no-staged-diff refusal, successful fixed-message commit dispatch, and message-file
  cleanup after success.
- The risky executable-surface regression continues to exclude `npx`, install, push,
  and reset operations.

## Verification

- `npm test -- scripts/agent-harness.test.ts` passed: 14 tests.
- `npm run verify` passed: preflight, change-documentation validation, strict
  TypeScript checks, 301 unit/domain tests, and 45 Playwright E2E workflows.

## Exploratory review

Interactive review is not applicable because this is a local command-harness workflow
change with no product UI surface.

## Documentation

Updated README, `.gitignore`, and the agent command harness specification and issue
tracker.
