# Exploratory review: server errors outrank page-reported success

Date: 2026-10-30. Build: `fix/server-error-precedence`, local API and fixture site,
Playwright-managed Chromium with the unpacked extension (`apps/extension/dist`), 1280×720. Each
run was driven from the assistant's visible controls (request, form choice, review, confirm,
start verification), then the Contact sales form was submitted with a typed email.

## Scenarios

| Scenario | Path | Page shows | Verdict | Next action (as shown) | Screenshot |
|---|---|---|---|---|---|
| `ajax_success` | happy | "Thanks, we'll be in touch." | `browser_verified` | No browser fix is needed | [ajax_success.png](2026-10-30-server-error-precedence/ajax_success.png) |
| `server_error_retry_success`: 503, then a 200 retry | happy / ambiguous | "Thanks" | `browser_verified` | No browser fix is needed | — |
| `third_party_error_after_success`: a cross-origin widget answers 500 | ambiguous | "Thanks" | `browser_verified` | No browser fix is needed | — |
| `server_error_with_success_event`: endpoint 503, page shows "Thanks" and pushes `generate_lead`, GA4 hit sent | negative | "Thanks" | `submission_failed` (was `browser_verified`) | "The page reported success, but the form endpoint returned HTTP 503 … GA4 may count a lead that does not exist." | [server_error_with_success_event.png](2026-10-30-server-error-precedence/server_error_with_success_event.png) |
| `redirect_server_error`: native POST to `/thank-you` answers 503 with a thank-you page | negative | "Thanks" heading on the thank-you URL | `submission_failed` (was `browser_verified`) | Same HTTP 503 conflict text | [redirect_server_error.png](2026-10-30-server-error-precedence/redirect_server_error.png) |
| `endpoint_rejection_with_success_event`: endpoint 422, page shows "Thanks" | negative | "Thanks" | `expected_non_conversion` (was `browser_verified`) | "… rejected the submission with HTTP 422 …" | [endpoint_rejection_with_success_event.png](2026-10-30-server-error-precedence/endpoint_rejection_with_success_event.png) |
| Hostile page forging `generate_lead` every 25 ms (`?adversary=datalayer`) on the `server_error` scenario | adversarial | "Something went wrong" | `submission_failed` | Standard next action (no forged signal reached the run, so no conflict) | [adversary_datalayer_server_error.png](2026-10-30-server-error-precedence/adversary_datalayer_server_error.png) |

The confirmed form keeps its highlight, the page's own success message or thank-you page stays
visible next to the failure verdict, and the typed email does not appear in the assistant.

## Findings

| Severity | Finding | Status |
|---|---|---|
| medium | In the 422 conflict, the explanation line under the verdict still says "The form was stopped by validation, so this attempt was not counted", while the next action says a `generate_lead` request was sent. The `submission_failed` explanation repeats the next action, so it is consistent. The explanation is fixed copy in `content-script.ts` (`formExplanation`), which the assistant UX work is replacing with a verdict presenter whose `submission_failed` copy says "nothing is sent to GA4". | Follow-up `.scratch/form-verdict-precedence/issues/02-presenter-conflict-copy.md`, for the presenter work; not changed here to stay out of that area. |
| low | The conflict next action is long (three sentences) and appears twice in the current panel (next action and explanation). | Folded into follow-up 02. |
| low | A form endpoint on another origin than the form's `action` (for example `api.example.com` behind a form on `www.example.com`) is not attributed to the form, so its failure cannot overrule a success signal. Before this change no failure could overrule one. | Documented in README known limits and `docs/product-plan/current-capabilities.md`. |

No blocker or high findings.
