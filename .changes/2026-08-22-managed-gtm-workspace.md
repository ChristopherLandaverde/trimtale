# Recognize containers and guard GTM workspace capacity

Change record version: 2

Issue: `.scratch/managed-gtm-workspace/issues/01-recognize-and-prepare-workspace.md`

## Summary

Connects the public GTM ID observed on a website to exact Google container discovery and adds explicit, capacity-safe preparation of one marked managed workspace.

## Why

Standard GTM accounts have only three concurrent workspace slots. The assistant must reuse one product-owned workspace without consuming a new slot for every request or confusing runtime observation with Google access.

## Behavior

Inspection matches exactly one accessible container and reports workspace availability without mutation. Explicit preparation rechecks state, creates at most one marked workspace, or synchronizes and reuses it. Full capacity, ownership collisions, disabled writes, ambiguous matches, and synchronization conflicts create nothing. Version creation, conflict resolution, publication, and platform confirmation remain out of scope.

## Regression coverage

Core policy tests cover exact recognition, ambiguity, capacity, ownership markers, reserved-name collisions, and reuse. Google-client tests cover read-only inspection, opt-in OAuth scopes, disabled writes, synchronized reuse, concurrent idempotency, capacity blocking, and conflict preservation. Chromium covers observed-ID matching, explicit one-time preparation, absence of publication language, and reviewed visual baselines for both the evidence path and completed workspace state.

## Verification

`npm run verify` passed with valid change documentation, strict TypeScript checks, 114 deterministic tests in the current workspace, all workspace builds, and 24 Chromium workflows. The completion gate used no Google credentials or real GTM workspaces.

## Exploratory review

`docs/reviews/2026-08-22-managed-gtm-workspace.md` records the agent-owned Chromium review. One stale-action finding was fixed and its baseline regenerated; no blocker or high findings remain.

## Documentation

Added the managed-workspace operating guide and accepted specification, updated product architecture and build stages, and defined `Recognized container` and `Managed workspace` in the domain glossary. No ADR is needed because this policy is localized and reversible before versioning/publishing is implemented.
