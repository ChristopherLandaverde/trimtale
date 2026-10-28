# Apply, validate, and version a reviewed form plan

Delivery mode: implementation

Status: resolved

## Production outcome

A practitioner can approve one reviewed `generate_lead` plan in the website workbench,
run the existing durable application/validation/version workflow, and review bounded
immutable-version evidence without publishing it.

## Non-goals

- Publication approval, publication, rollback, or post-publication verification.
- Splitting the backend resume operation into new workflow stages.
- Navigation, Enhanced Measurement expansion, reporting, MCP, or model behavior.
- Claiming production readiness from mocked Google responses.

## Authorization

The product owner chose to continue the MVP workflow after the Playwright reliability
checkpoint on 2026-08-23. The active handoff recommends exposing the existing resume
operation as the fastest safe slice.

## Regression contract

- `tests/e2e/conversational-form.spec.ts` proves a ready plan presents an exact
  application confirmation before any resume request.
- The confirmed action sends only the bounded operation ID through the extension
  bridge, renders passed validation and immutable version evidence, and states that
  publication still needs separate approval.
- The same suite proves blocked or invalid resume responses fail closed without
  rendering raw provider details or calling publication routes.
- Existing backend workflow-runner tests remain authoritative for idempotent
  application, validation, persistence, and version creation.

## Comments

- 2026-08-23: Claimed before browser regression and implementation.
- 2026-08-23: Both new browser journeys failed at the missing application action.
- 2026-08-23: Implemented the bounded resume bridge, exact confirmation, version
  result, and fail-closed response handling. All seven lead-form journeys passed.
- 2026-08-23: Exploratory review found no unresolved blocker or high-severity issue.
- 2026-08-23: Full verification passed: 273 deterministic tests and 43 Chromium
  journeys. Issue resolved.
