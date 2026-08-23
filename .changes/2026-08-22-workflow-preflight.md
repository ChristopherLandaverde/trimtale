# Automate workflow readiness and CI concurrency

Change record version: 2

Issue: `.scratch/workflow-automation/issues/01-delivery-preflight.md`

## Summary

Added deterministic local and credential-safe Google readiness reports, made local
preflight part of ordinary verification, and removed duplicate pull-request CI runs.

## Why

Missing tools and configuration previously surfaced late, while each pull-request
commit launched both push and pull-request verification. Early fixed checks and one
current CI job reduce avoidable interruptions without weakening completion gates.

## Behavior

`npm run agent -- preflight` checks supported runtimes, repository dependencies,
required scripts, and managed Chromium. `npm run preflight:google` separately checks
credential/configuration presence and exact boundary shapes without printing values or
contacting Google. CI now runs once for a pull request, cancels obsolete runs for the
same change, and verifies `main` after merge.

Credentialed readiness remains outside the agent allowlist and ordinary CI. Preflight
does not prove live OAuth access, workspace capacity, or Google availability.

## Regression coverage

`scripts/workflow-preflight.test.ts` covers ready and missing local prerequisites,
credential redaction, exact Google configuration, and permissive/malformed rejection.
`scripts/ci-policy.test.ts` protects the PR/main trigger and concurrency policy.
`scripts/agent-harness.test.ts` asserts the exact new local-preflight mapping.

## Verification

Local and fake-config Google preflights passed, with no credential values in output.
The focused regression contract passed 13 tests. `npm run agent -- verify` passed the
new readiness gate, change-documentation and TypeScript checks, all 124 deterministic
tests, every workspace build, and all 25 Chromium workflows.

## Exploratory review

Not applicable. This changes repository workflow automation and command-line reports,
not the built product or a user-visible browser workflow.

## Documentation

Added the accepted resumable-automation specification, six staged implementation
issues, canonical tracking-change-plan and publication-approval language, and README
instructions for both preflight lanes.
