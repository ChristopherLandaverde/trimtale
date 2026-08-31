# Extract workflow bridge contracts

Status: resolved

## Problem

Workflow action names and result mappings are duplicated between the content script,
service worker, and API types. This makes future workflow states more expensive and
risky.

## Regression Contract

- Move extension workflow bridge types and stored-operation mapping to a shared
  extension module.
- Add unit tests for stored-operation mapping across Phase 1 terminal states.
- Preserve message names and local API endpoints.
- Run `npm run verify` before resolving.

## Acceptance Criteria

- [x] Content script and service worker import one shared workflow bridge contract.
- [x] Mapping tests cover `published`, `completed`, `rollback_required`, and
      `rolled_back`.
- [x] Unsupported operation states still fail closed as blocked.

## Resolution Notes

- Added `apps/extension/src/workflow-bridge.ts` for workflow action names,
  request/response/result types, and stored-operation mapping.
- Updated the content script, service worker, and setup-operation presenter to import
  shared bridge types instead of duplicating workflow result contracts.
- Added `apps/extension/src/workflow-bridge.test.ts` to cover Phase 1 terminal
  mappings, resumable stored states, and unsupported states that fail closed.
