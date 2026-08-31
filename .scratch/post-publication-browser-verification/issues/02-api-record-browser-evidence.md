# Add API route for browser verification evidence

Status: resolved

Blocked by: 01

## Objective

Expose a local API route that records privacy-filtered post-publication browser
evidence for a published operation and persists the resulting operation state.

## Regression contract

Add API tests covering:

- `POST /api/google/workflows/:id/browser-verification` records matching evidence.
- Unknown operation IDs return `404`.
- Non-published operations return `409`.
- Wrong-specification evidence returns `409`.
- Raw private fields and arbitrary error bodies are not echoed in responses.
- The route never calls Google publish, rollback, or platform confirmation APIs.

## Notes

This route should update operation persistence only. It should not perform browser
automation itself.

## Resolution Notes

- Added `POST /api/google/workflows/:id/browser-verification` as a narrow persistence
  route for already-published operations.
- `apps/api/src/workflow-routes.ts` validates the evidence envelope and delegates to
  `TrackingWorkflowRunner.recordBrowserVerification`; it does not run browser
  automation or call Google publication, rollback, or platform-confirmation APIs.
- `apps/api/src/workflow-runner.test.ts` covers matching evidence, wrong
  specification rejection, pre-publication rejection, completed state, and
  rollback-required state.
- Extension E2E in `tests/e2e/navigation-extension.spec.ts` covers the route from the
  visible assistant for navigation and lead-form workflows.
