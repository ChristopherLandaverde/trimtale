# Extract workflow bridge contracts

Status: proposed

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

- [ ] Content script and service worker import one shared workflow bridge contract.
- [ ] Mapping tests cover `published`, `completed`, `rollback_required`, and
      `rolled_back`.
- [ ] Unsupported operation states still fail closed as blocked.
