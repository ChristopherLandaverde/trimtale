# Disposable workflow smoke form exploratory review

Date: 2026-08-23

Build: `feat/disposable-workflow-smoke-form` before commit.

Environment: Playwright Chromium 1234 on Linux, local verification target at
`http://127.0.0.1:4175/`, with the external GTM script intercepted so the review did
not contact Google.

## Scenarios exercised

### Required-field validation

1. Loaded the verification target with its default test container.
2. Submitted `#workflow-smoke-form` with an empty work-email field.
3. Confirmed that native validity blocked submission, the success message remained
   hidden, and no `gtm_observability_smoke_success` event was pushed.

Observed: the form stayed in its initial state and Chromium displayed its native
required-field feedback. The native feedback text appears faint in the headless
screenshot, but it is browser-owned UI rather than application content.

### Adversarial invalid value

1. Entered `<img src=x onerror=alert(1)>@example.com` into the email field.
2. Confirmed that the field remained invalid and the form could not produce a success
   outcome.

Observed: the value was treated only as invalid input. No markup or script was
interpreted and no tracking signal was pushed.

### Successful outcome and privacy boundary

1. Entered `review@example.com`.
2. Submitted the form once.
3. Inspected the visible state and matching `dataLayer` entries.

Observed: `Verification request received.` became visible and exactly one
`gtm_observability_smoke_success` event was present. The event contained only
`form_id` and `form_name`; the entered email was absent.

## Visual review

The page remained readable at the reviewed 1280-by-720 viewport. The form, call to
action, and success message have a clear visual hierarchy, no content overlaps, and no
unexpected layout shift after submission.

## Review result

Result: pass.

No application finding blocks the local slice. Deployment and credentialed Google
evidence remain separate approval-gated operational work.
