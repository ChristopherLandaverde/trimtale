# Complete the demo GA4 request

Delivery mode: implementation
Status: resolved

## Production outcome

Submitting the controlled demo form emits one `generate_lead` request with the exact
required `form_id`, `form_name`, and `page_location` parameters, allowing the ordinary
browser verifier to pass the safe walkthrough.

## Non-goals

- Weakening or bypassing required-parameter verification.
- Sending the entered email or any other form value.
- Changing production GTM generation or provider behavior.

## Authorization

The practitioner reported that the interactive demo failed verification with a
missing required `generate_lead` parameter after submitting the form on 2026-08-27.

## Regression contract

- `scripts/stage1-interactive-demo.test.ts` requires the demo request to send
  `form_id`, `form_name`, and the current page location while excluding the email input
  value.
- Existing form-verdict tests continue to require all three parameters and the browser
  journeys continue to protect the production verifier.

## Comments

- 2026-08-27: Claimed from the live demo report. Inspection confirmed that the demo
  beacon sent only `v` and `en`, while the reviewed setup requires three parameters.
- 2026-08-27: The failing-first demo contract reproduced the incomplete request. The
  corrected demo, form-evidence, and form-verdict suites pass 42 focused tests.
- 2026-08-27: Resolved after the fresh corrected demo opened and `npm run verify`
  passed 466 deterministic tests and 87 Chromium journeys.
