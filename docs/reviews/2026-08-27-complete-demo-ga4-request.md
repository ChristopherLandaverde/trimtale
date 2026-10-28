# Complete demo GA4 request review

Date: 2026-08-27

## Environment

- Fresh visible Chromium profile with the built production extension.
- Safe Stage 1 interactive page and intercepted Google endpoints.
- Production form-evidence and form-verdict contracts.

## Scenarios

1. Reproduced the practitioner's failed run with an event-only `generate_lead`
   request and confirmed the verifier rejected it.
2. Opened a fresh corrected demo whose request includes the exact form ID, form name,
   and current page location.
3. Inspected the request construction against the privacy boundary and confirmed it
   never reads or encodes the email input.

## Observations

- The original missing-parameter verdict was accurate; verification was not weakened.
- The corrected request matches the generated form contract's three required
  parameters.
- The demo continues to intercept the request locally and performs no real Google or
  provider mutation.
- Only structural form metadata and the page URL enter the request. The entered value
  remains excluded.

## Findings

- High, resolved: the demo simulated the event name but omitted every required
  `generate_lead` parameter, so an otherwise correct walkthrough could not pass.
- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- `scripts/stage1-interactive-demo.test.ts` protects the complete privacy-safe request.
- Focused demo, form-evidence, and form-verdict suites: 42 tests passed.
- Fresh corrected interactive demo opened in visible Chromium.
- `npm run verify`: 466 deterministic tests and 87 Chromium journeys passed.
