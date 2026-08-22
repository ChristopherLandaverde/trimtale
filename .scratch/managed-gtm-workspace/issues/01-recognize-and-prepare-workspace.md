# Recognize the page container and prepare one managed workspace

Status: resolved

## Outcome

Connect safe page-runtime GTM recognition to Google container discovery and implement the capacity-safe, idempotent managed-workspace preparation boundary.

## Acceptance criteria

- [x] Core policy returns every recognized-container and managed-workspace result state deterministically.
- [x] Google client supports exact public-ID matching, workspace status/synchronization, and guarded creation.
- [x] Backend exposes separate inspection and explicit preparation endpoints.
- [x] The extension presents the match and workspace state using the observed page container ID.
- [x] No ordinary test calls Google or consumes real workspace capacity.
- [x] Specification, product architecture, operational documentation, and change record agree with behavior.
- [x] Full completion gate passes.

## Comments

- 2026-08-22: Claimed after confirming the standard GTM limit is one default plus two custom workspaces. The implementation will reserve at most one marked custom workspace and degrade to non-mutating planning when capacity is unavailable.
- 2026-08-22: Resolved with exact page-container recognition, separate inspection and explicit preparation, opt-in edit scope, guarded reuse/creation, navigation and lead-form assistant coverage, and reviewed visual baselines. `npm run verify` passed with 114 deterministic tests and 24 Chromium workflows; no Google credentials or real workspaces were used.
