# Exploratory review: form verdicts from real browser signals

Date: 2026-10-30. Build: `feat/form-verdicts-real-signals`, local API and fixture site, Playwright-managed Chromium with the unpacked extension (`apps/extension/dist`), 1280×800.

The fixture page sets no verdict flags (`<html>` carries no `data-*` attributes before or after the submit). Every form verdict below came from the browser itself.

## Scenarios

| Scenario | Path | Observed verdict | Screenshot |
|---|---|---|---|
| AJAX success (`ajax_success`) | happy | `browser_verified` | [ajax_success.png](2026-10-30-form-real-signals/ajax_success.png) |
| Native POST to a thank-you page (`thank_you_redirect`) | happy, cross-page | `browser_verified`, after "The form submission opened /thank-you. Continuing verification of Contact sales here." | [thank_you_redirect.png](2026-10-30-form-real-signals/thank_you_redirect.png) |
| Embedded form rendered by a script, no iframe (`embedded_form`, XHR submit) | happy | `browser_verified` | [embedded_form.png](2026-10-30-form-real-signals/embedded_form.png) |
| Endpoint returns 500 (`server_error`) | negative | `submission_failed` | [server_error.png](2026-10-30-form-real-signals/server_error.png) |
| Browser constraint validation blocks the submit (`html5_validation_failure`) | negative | `expected_non_conversion` | [html5_validation_failure.png](2026-10-30-form-real-signals/html5_validation_failure.png) |
| Consent Mode default `analytics_storage: denied` (`consent_denied`) | ambiguous | `consent_limited` | [consent_denied.png](2026-10-30-form-real-signals/consent_denied.png) |

Adversarial input: every fixture dataLayer push carries the typed email in `lead_email`, and the E2E page-observer test pushes the sentinel email as `email` and `form_name`. The serialized page signals, API request bodies and the rendered assistant never contained the sentinel value (`tests/e2e/form-real-signals.spec.ts`). GA4 URLs with `ep.email`/`uid` values are reduced to the allowlist (`packages/core/src/form-signals.test.ts`).

## Findings

| Severity | Finding | Status |
|---|---|---|
| minor (pre-existing) | Verdict messages lead with raw codes (`Verdict: submission_failed`) and the fallback explanation starts lowercase (`submission failed. Fix the form…`). This breaks the ux-standards copy rules but predates this change. | Not changed here: copy changes need Christopher's review. Logged as a follow-up. |
| minor | A `fetch` whose response body the page never reads produces no Resource Timing entry in Chromium, so its HTTP status isn't seen. | Documented in README Known limits. Real form handlers almost always read the body. |
| minor | GA4 events batched into a POST body (no `en` in the URL) are not attributed to the run. | Documented in README Known limits. |

No blocker or high-severity findings.
