# Add API route for browser verification evidence

Status: open

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
