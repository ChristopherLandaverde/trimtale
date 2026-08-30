# Define assistant operation-start contract

Status: resolved

## Objective

Define the request, response, and UI-state contract that lets the assistant start a
tracking setup operation only from a confirmed tracking specification, generated setup,
and recognized container with container-write access.

## Regression contract

Add deterministic tests covering:

- Navigation-click and lead-form payloads accepted from confirmed setup state.
- Missing confirmation, missing setup generation, read-only access, disconnected
  Google authorization, inaccessible public IDs, ambiguous public IDs, and multiple
  observed containers refusing operation start.
- Runtime validation that rejects raw selectors or page text outside the existing
  privacy-filtered setup payload.
- A built-extension E2E happy path showing the **Prepare GTM version** action only
  when the prerequisites are met.

## Notes

Reuse the existing tracking specification, generated setup, recognized container, and
tracking setup operation vocabulary. Do not introduce a second operation model in the
extension.

Resolved in the first assistant workflow slice. The extension now derives the workflow
request from the same confirmed setup payload used for GTM JSON generation and renders
**Prepare GTM version** only after GTM access inspection reports a recognized container
with write access.
