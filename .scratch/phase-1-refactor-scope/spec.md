# Phase 1 Refactor Scope

Status: proposed

## Objective

Reduce implementation risk before real Google testing by separating Phase 1 workflow
concerns that are currently working but densely coupled. This refactor should not add
new product behavior. It should make the completed local loop easier to test,
debug, and safely operate:

```text
confirm -> generate -> GTM access -> workspace -> apply -> validate -> version
  -> approve publish -> browser verify -> rollback if failed
```

## Refactor Boundary

This effort may reorganize code, extract helpers, add typed adapters, and improve test
fixtures. It must not change:

- tracking specification semantics;
- GTM generated entity output;
- publication, browser verification, or rollback state transitions;
- OAuth scopes, environment flags, CORS behavior, or local ports;
- user-visible claims about platform confirmation;
- ordinary `npm run verify` coverage expectations.

Real Google testing remains separate. This scope prepares for it; it does not replace
credential-gated disposable-resource validation.

## Current Pressure Points

- `apps/extension/src/content-script.ts` is a single 1,876-line file that owns overlay
  UI, GTM connection rendering, setup-operation rendering, bridge requests, form
  evidence classification, navigation evidence capture, and post-publication actions.
- `apps/extension/src/service-worker.ts` mixes assistant streaming, local API bridge
  calls, stored workflow mapping, and network evidence enrichment.
- `tests/e2e/navigation-extension.spec.ts` is 1,200 lines and now carries large inline
  navigation and form operation fixtures plus reusable route mocks.
- Workflow result types are duplicated across API, service worker, and content script.
- Operation timeline rendering is string-heavy, making it easy to accidentally
  overclaim platform confirmation or hide rollback state during future changes.

## Proposed Workstreams

### 1. E2E Workflow Fixture Harness

Move large inline operation factories and route mocks out of
`tests/e2e/navigation-extension.spec.ts` into a helper module.

Targets:

- `operation(...)` and `formOperation(...)` become typed fixture builders.
- `mockWritableContainerAndWorkflow(...)` becomes a reusable test helper.
- Tests read like practitioner journeys instead of setup mechanics.

Acceptance:

- No change to exercised browser behavior.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passes.

### 2. Setup Operation Presenter

Extract setup-operation display logic from `content-script.ts` into a pure presenter
that converts a workflow result into rows, labels, guidance, and allowed actions.

Targets:

- Pure model:
  - heading label;
  - timeline rows;
  - guidance text;
  - action descriptors.
- Rendering function consumes the presenter output and creates DOM nodes.
- Unit tests assert platform confirmation remains unavailable and rollback action
  appears only for `rollback_required`.

Acceptance:

- Existing E2E screenshots and role/name assertions continue to pass.
- No exact copy churn unless required to preserve current semantics.

### 3. Shared Workflow Bridge Contracts

Create a small shared extension-side module for workflow bridge request/response
types and stored-operation mapping.

Targets:

- Move `WorkflowResult`, workflow action names, and bridge payload types out of
  content/service-worker files.
- Keep server API types authoritative where possible.
- Add focused unit coverage for stored operation mapping:
  - `published` -> `verify_publication`;
  - `completed` -> `platform_unavailable`;
  - `rollback_required` -> `rollback_approval`;
  - `rolled_back` -> `complete`.

Acceptance:

- No user-visible UI change.
- `npm run check` and mapping tests pass.

### 4. Evidence Capture Controllers

Extract navigation and form post-publication evidence orchestration from
`content-script.ts`.

Targets:

- Navigation controller owns:
  - active operation/request state;
  - verified target scope;
  - delayed request observation;
  - verdict-to-record callback.
- Form controller owns:
  - active operation/request state;
  - sanitized run evidence construction;
  - private-value exclusion sentinel hooks.

Acceptance:

- Navigation and lead-form post-publication E2E continue to pass.
- Duplicate and missing request verdicts continue to drive rollback-required state.

### 5. API Route Handler Extraction

Optionally extract workflow route handlers from `apps/api/src/server.ts` once the
extension-facing refactors are stable.

Targets:

- Keep HTTP parsing, bounded errors, and response shaping close together.
- Preserve route paths and status codes exactly.
- Add handler-level unit tests only if extraction makes existing coverage less direct.

Acceptance:

- `npm test` and `npm run test:e2e` pass.
- No CORS, OAuth, or flag behavior changes.

## Suggested Sequence

1. Extract E2E workflow fixtures first. This lowers risk for every later refactor.
2. Extract setup-operation presenter. This protects the most fragile product claims.
3. Extract workflow bridge contracts and stored-operation mapping.
4. Extract evidence capture controllers.
5. Consider API route handler extraction only after extension code is calmer.

## Regression Contract

Every refactor issue must keep the same completion gate:

- focused unit tests for any pure extracted module;
- targeted E2E for the affected assistant path;
- full `npm run verify` before merge or completion.

No refactor issue may be marked resolved if it:

- weakens or removes an existing regression;
- changes platform-confirmation language without an explicit product decision;
- bypasses visible assistant actions with direct API-only testing;
- changes real Google publication or rollback guards.

## Acceptance Criteria

- [x] `content-script.ts` no longer owns
      post-publication evidence orchestration in one file.
- [x] Workflow operation fixtures are reusable outside
      `tests/e2e/navigation-extension.spec.ts`.
- [x] Platform-confirmation boundary has unit-level presenter coverage.
- [x] Rollback action visibility has unit-level presenter coverage.
- [x] Navigation and lead-form post-publication E2E remain green.
- [x] Full `npm run verify` passes after each refactor slice.

## Out of Scope

- New product behavior.
- Real Google disposable-resource testing.
- Visual redesign.
- Model-backed intake changes.
- New destination/platform confirmation integrations.
