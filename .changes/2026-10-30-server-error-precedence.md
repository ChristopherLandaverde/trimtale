# Server errors outrank page-reported success

Change record version: 2

Issue: `.scratch/form-verdict-precedence/issues/01-network-outranks-page-success.md`

## Summary

A form whose endpoint failed is no longer reported as a success because the page showed a
success message, reached its thank-you URL or pushed its success dataLayer event. The form
endpoint's answer now outranks every page-reported signal, and the conflict is kept in the
evidence and named in the next action.

## Why

In `FormRun` an observed outcome outranked a 5xx, so a page that said "Thanks" after a 503 could
read as `browser_verified`, hiding both the lost lead and a `generate_lead` hit for a lead that
does not exist. Network evidence must outrank page-controlled evidence, as #60 established for
dataLayer signals.

## Behavior

- Submission-result order, documented on `FormRun#submissionResult` and in
  `docs/product-plan/current-capabilities.md`: (1) 5xx from the form endpoint → `server_error`;
  (2) 400/422 from the form endpoint → `validation_error`; (3) the confirmed success signal →
  `success`; (4) client-side validation → `validation_error`; (5) a failure not attributable to
  the form; (6) `unknown`.
- Verdict changes: endpoint 5xx with page success, `browser_verified` (or a tracking-defect code)
  → `submission_failed`; native POST returning 5xx onto the thank-you URL → `submission_failed`;
  endpoint 400/422 with page success → `expected_non_conversion`; client validation followed by
  an endpoint 5xx → `submission_failed` (was `expected_non_conversion`).
- Attribution: a fetch/XHR counts as the form endpoint when it goes to the form's action origin
  (the page itself when there is no `action`), and the document a native POST returned always
  counts. A failure from another origin (an analytics or chat widget) no longer turns an observed
  success into a failure; without a success it still gives `submission_failed`, as before.
- Retries: the latest status per endpoint (origin + path) wins, so a 503 followed by a successful
  retry is `browser_verified`. Endpoint paths stay in memory; only standing failure statuses are
  serialized across a navigation.
- Evidence gains optional `observations.interaction.responseStatus` (100–599, validated). The
  success signal stays as observed (`outcome.observed`, dataLayer events, GA4 requests). The next
  action reads "The page reported success, but the form endpoint returned HTTP 503 …", adding
  that GA4 may count a lead that does not exist when a `generate_lead` request was sent.
- Unchanged: verdict codes, the verdict engine's order, and the panel rendering (no
  `content-script.ts` change). Out of scope: endpoints on another origin than the form's action
  (such as a separate API subdomain) cannot overrule a success signal (README known limits).

## Regression coverage

- `packages/core/src/form-signals.test.ts`: 12 new tests for the precedence order, both arrival
  orders, native POST 5xx onto the thank-you URL, failures surviving a navigation, retries,
  third-party attribution, `isFormEndpointRequest`, and no endpoint path in the serialized run.
- `packages/core/src/form-verdict.test.ts`: conflict next actions, unchanged standard next
  actions, and the five new fixture IDs.
- `packages/core/src/contracts.test.ts`: `responseStatus` validation.
- Fixture site: five scenarios (`server_error_with_success_event`, `redirect_server_error`,
  `endpoint_rejection_with_success_event`, `server_error_retry_success`,
  `third_party_error_after_success`; 23 total) with `form-scenarios.test.ts` coverage.
- `tests/e2e/form-real-signals.spec.ts`: the five scenarios get their verdicts in Chromium, and
  the conflict next action with the HTTP status is visible in the assistant.
- `tests/e2e/form-fixtures.spec.ts`: each endpoint really answers with its scenario status, and
  the widget's cross-origin 500 is visible to Resource Timing (so the third-party case is real).
- The existing "observed success outranks an earlier validation failure" test is kept, renamed
  to say client-side validation.

## Verification

See the pull request for the final run: `npm run check`, `npx vitest run`, `npm run build`,
`npx playwright test`.

## Exploratory review

`docs/reviews/2026-10-30-server-error-precedence.md`.

## Documentation

`docs/product-plan/current-capabilities.md` (signal table, precedence order),
`docs/security-and-publishing.md` (network over page for submission results), README known
limits, `.scratch/form-verdict-precedence` issue 01, and the follow-up status in
`docs/reviews/2026-10-30-forge-proof-page-signals.md`.
