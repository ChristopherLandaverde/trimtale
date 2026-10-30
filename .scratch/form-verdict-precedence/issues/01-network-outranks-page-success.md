# A failed form submission can be reported as a success

Status: resolved

## Objective

In `FormRun` (Slice 1, #59) an observed outcome outranked every response failure. A page that
showed its success message, reached its thank-you URL or pushed its success dataLayer event after
the form endpoint returned 5xx got `submissionResult: "success"`, so a failed submission could
read as `browser_verified` or as a tracking defect. Found as a medium finding in
`docs/reviews/2026-10-30-forge-proof-page-signals.md`; Christopher approved the fix on
2026-10-30.

Decision: network evidence for the form's own submission outranks page-reported evidence,
consistent with #60. The success element, thank-you URL and dataLayer event are all page state.

## Regression contract

- `packages/core/src/form-signals.test.ts` ("verdict precedence" and "form endpoint
  attribution"): 5xx beats a dataLayer success event in either order; a native POST that returned
  503 beats the thank-you URL; a server error survives a navigation; 400/422 beats page success;
  server error beats endpoint rejection and client validation; a retry to the same endpoint
  clears its failure, a success from another endpoint does not; an unattributable third-party
  500 does not beat an observed success but still counts without one; the endpoint path never
  reaches the serialized run.
- `packages/core/src/form-verdict.test.ts`: the conflict next action names the HTTP status and,
  when a GA4 request was sent, the false lead; failures without a success signal keep the
  standard next action; the five new fixture IDs map to their verdicts.
- `packages/core/src/contracts.test.ts`: optional `interaction.responseStatus` accepts 100–599
  integers and rejects anything else.
- `apps/fixture-site/src/form-scenarios.test.ts`: five new scenarios (23 total).
- `tests/e2e/form-real-signals.spec.ts`: `server_error_with_success_event` and
  `redirect_server_error` → `submission_failed` with the HTTP 503 conflict visible;
  `endpoint_rejection_with_success_event` → `expected_non_conversion` with HTTP 422;
  `server_error_retry_success` and `third_party_error_after_success` → `browser_verified`.
- `tests/e2e/form-fixtures.spec.ts`: each scenario's endpoint really answers with its status,
  and the cross-origin widget's 500 is visible to Resource Timing.

## Answer

`FormRun#submissionResult` now resolves conflicts in one documented order: form-endpoint 5xx,
form-endpoint 400/422, the confirmed success signal, client-side validation, then failures not
attributable to the form. A response is attributable when it goes to the form's action origin
(fetch/XHR) or is the document a native POST returned. The latest status per endpoint wins, so a
retry clears an earlier failure. Evidence keeps the success signal and adds
`interaction.responseStatus`; the next action names the conflict. See
`.changes/2026-10-30-server-error-precedence.md`.
