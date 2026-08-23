# Keep intake evaluations backend-only

Status: resolved

## Objective

Restore the tracking assistant to a customer-facing conversation surface only. Intake
model evaluation remains an owner-operated backend harness with protected read-only
report storage; it has no extension control, panel, report bridge, or visible product
state.

## Regression contract

Required test levels:

- Extension unit/build coverage under `npm test` and strict TypeScript checking.
- Built-extension chat journeys and reviewed visual baselines under Playwright.

Required cases and invariants:

- The expanded assistant header contains only the existing collapse control and no
  `Evals`, evaluation-report, model-report, or provider-report control.
- The service worker accepts no intake-evaluation report message and performs no
  intake-evaluation HTTP request.
- Submitting a chat request clears the composer immediately, renders the user message,
  begins the local streamed response promptly, and completes with the expected actions.
- Conversation state, target highlighting, form intake, navigation intake, keyboard
  submission, collapse, preferences, evidence, and GTM workflows remain unchanged.
- The backend owner command and protected read-only report API remain available and
  keep their credential, paid-call, execution, and write boundaries.
- No credential, provider call, GTM mutation, or publication occurs during verification.

## Work

- Remove the extension report decoder, service-worker bridge, report panel, styles,
  fixtures, journeys, and report-specific visual baselines.
- Restore the six assistant baselines that changed only for the visible `Evals` control.
- Update product and engineering documentation to state the backend-only boundary.
- Run a headed chat-only exploratory session focused on perceived responsiveness.

## Done when

- The customer-facing assistant has no evaluation UI or bridge.
- Chat response and regression journeys pass against the production extension build.
- Visual diffs show only removal of the evaluation control.
- `npm run verify` and the exact-base change-documentation check pass.

## Comments

- 2026-08-23: Product direction corrected immediately after the report UI merged:
  evaluation is observability infrastructure, not a frontend feature. The backend
  evaluator and read-only API remain in scope; only the extension surface is removed.
- 2026-08-23: The customer-facing absence regression failed first on the visible model
  report button, then passed after removal. Six focused Chromium journeys and restored
  visual baselines passed.
- 2026-08-23: `npm run verify` passed local preflight, 34 change records, all builds and
  strict checks, 264 deterministic tests across 37 files, and 27 Chromium journeys. No
  credential, provider call, GTM write, or publication ran.
