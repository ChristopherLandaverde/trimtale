# Agent Command Harness

Status: accepted

## Problem

Routine local engineering work currently uses several direct `npm`, `npx`, and
read-only `git` command shapes. Authorization therefore interrupts otherwise
autonomous implementation even when the intended operation is deterministic,
repository-scoped, and non-destructive.

## User outcome

An agent can invoke one repository-owned command surface for ordinary inspection,
build, test, and verification work. A user can authorize that narrow surface
without also authorizing arbitrary shell execution, dependency downloads, remote
writes, destructive Git operations, or credentialed integrations.

## Acceptance criteria

- [x] `npm run agent -- <command>` supports documented local inspection and
  verification commands.
- [x] Commands and arguments are matched against a closed allowlist.
- [x] Every child process runs from the repository root with inherited output.
- [x] The harness does not install dependencies, use the network intentionally,
  stage changes, push, run destructive Git commands, or access credentialed
  integrations. Its only Git mutation is the guarded `commit` command for an
  already-staged index and fixed message file.
- [x] The harness inherits the invoking process environment, matching direct `npm`
  and `git` use, but does not load environment files or select credentialed scripts.
- [x] Unknown commands and extra arguments fail before a child process starts.
- [x] The ordinary test gate includes permanent harness regressions.
- [x] `npm run verify` passes.

## Out of scope

- Dependency installation or arbitrary package execution.
- Git branch creation, staging, pushes, resets, or other repository mutation beyond
  the guarded fixed-message `commit` command.
- GitHub, Google, or other external-service operations.
- A general-purpose shell escape hatch.

## Local artifact boundary

Repository-wide ignore rules exclude `.env*.local`, `.vercel/`, and generated
`.build/` directories so local credentials, deployment linkage, and build output do
not enter a harness change through broad staging.

The fixed harness commit message file `.scratch/commit-message.md` is ignored and
deleted after a successful harness commit.
