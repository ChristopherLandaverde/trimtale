# Add an allowlisted agent command harness

Change record version: 2

Issue: `.scratch/agent-command-harness/issues/01-allowlisted-command-surface.md`

## Summary

Added a repository-owned `npm run agent -- <command>` dispatcher for routine local
inspection, build, test, and verification work.

## Why

Consolidating safe, deterministic operations behind a narrow command surface reduces
authorization interruptions without granting arbitrary command execution.

## Behavior

The harness accepts documented command names with no additional arguments, runs each
fixed invocation from the repository root, and returns the child exit status. Package
installation, arbitrary `npx`, credentialed integrations, Git mutation and remote
operations, destructive commands, and shell passthrough remain out of scope.
It intentionally inherits the caller's environment, matching the direct commands it
wraps, but does not load environment files or select credentialed scripts. Repository
ignore rules protect local environment, Vercel linkage, and generated build artifacts
from accidental staging.

## Regression coverage

`scripts/agent-harness.test.ts` covers every fixed mapping exactly, repository-root execution,
exit propagation, help, rejection of unknown commands and extra arguments, and the
absence of risky executable surfaces. Script tests now run in the ordinary Vitest gate.

## Verification

Focused harness coverage passed with 7 tests. `npm run agent -- verify` passed the
change-documentation and TypeScript gates, all 114 deterministic tests, all workspace
builds, and all 25 Chromium workflows.

## Exploratory review

Not applicable. This change adds an internal repository command dispatcher and does
not alter the built product or a user-visible workflow.

## Documentation

Added the accepted harness specification, implementation issue, README usage and
authorization boundary, and this change record.
