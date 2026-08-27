# Exact workflow recovery review

Date: 2026-08-26

## Environment

- Built production extension in dedicated Chrome Stable.
- Credentialed local API with GTM writes and publication locked to
  `GTM-PCJ3Q5RK`; Analytics writes disabled.
- Disposable ConsentFlow target, managed workspace `8`, and GA4 destination
  `G-YV879ECLRV`.
- Supported Google Tag Manager Preview and Tag Assistant connection.

## Scenarios

1. Replayed a negative exact-preview run with the success element below the
   100-percent Element Visibility threshold.
2. Replayed the happy path after centering the confirmed form, using a private sentinel
   value and the exact validated preview binding.
3. Reloaded the versioned target and repeated intake to test durable recovery from a
   browser interruption.

## Observations

- Negative preview `1787797775234` exposed the success state below the viewport.
  Tag Assistant recorded the site success event but no `gtm.elementVisibility` and no
  `generate_lead`; the operation stopped without creating a version.
- Exact preview `1787798374219` emitted `gtm.elementVisibility` and one
  `generate_lead` request for `G-YV879ECLRV` with `workflow-smoke-form`,
  `Disposable workflow smoke form`, and the preview page location.
- The private sentinel was absent from the Analytics request and durable evidence.
- Run `run_form_1787798730306` bound setup `setup_d729b06cc79a`, workspace
  `1787795812815`, and preview `1787798374219` before Google created immutable
  version `6` with fingerprint `1787798811643`.
- Live remained version `3` with fingerprint `1787458659661`; publication was not
  started.
- After reload, the website agent restored `Review publication` for the exact version
  and exposed no repeated apply action.

## Findings

- Medium: the expanded agent and sticky page header can overlap a form control in a
  narrow Tag Assistant target viewport. Collapsing the agent or centering the target
  clears it. Issue 23 owns the product-level interaction treatment.
- No blocker or high-severity finding.

## Evidence

- `npm run verify`: 421 deterministic tests and 73 Chromium journeys passed.
- Focused regressions: 31 form-verdict tests, one published-resume API test, and two
  built-extension restart journeys passed.
- Durable record:
  `.data/stage1-google-smoke-operations-live-retry-3.json`.
- Captures: `.data/stage1-live-retry-versioned.png` and
  `.data/stage1-version-5-review.png` (the latter filename predates version `6`).
