# Conversational form E2E exploratory review

Date: 2026-08-22

Build: `feature/conversational-form-e2e` working tree before final commit.

Environment: Playwright Chromium 1234 on Linux, unpacked extension from `apps/extension/dist`, deterministic local API and fixture services only.

## Scenarios exercised

### Confirmed successful lead

Entered `Track leads from the contact form`, selected the highlighted Contact sales form, reviewed and confirmed the `generate_lead` specification, and downloaded the GTM container import. The artifact contained one trigger and one tag, required form metadata, and no `private@example.com` sentinel value. After guided submission, the page displayed its success element and the assistant reported `browser_verified`, browser verification `passed`, platform confirmation `unverified`, and the next action.

### Validation failure

Repeated the same confirmed workflow against the validation fixture. No success element or analytics request appeared. The assistant reported `expected_non_conversion`, browser verification `failed`, platform confirmation `unverified`, and explained that the attempt was not counted and should be submitted again after correcting the input.

### Existing behavior

Ran the entire E2E suite after the new journeys. Navigation conversation, target highlights, GTM runtime detection, page-controlled label safety, and all sixteen form fixture scenarios remained green.

## Visual and artifact review

- `confirmed-form-success-final.png` shows the confirmed target, success outcome, complete browser verdict, platform boundary, and explanation together.
- `validation-error-is-not-a-conversion-final.png` shows the confirmed target with no success outcome and the complete non-conversion verdict and corrective guidance.
- The downloaded `gtm-observability-generate-lead.json` is a GTM export-format version 2 artifact with a confirmed visible-element trigger and no submitted form values.

## Findings and remediation

### E2E-08-01 — Download opened raw JSON instead of producing a file

Severity: high

Resolution: replaced the isolated-world blob navigation with a directly clicked download link. Playwright now captures and parses the real file, including its suggested filename. A service-worker download experiment was removed because it bypassed Playwright's controlled artifact directory.

### E2E-08-02 — Final validation verdict was partially clipped

Severity: medium

Resolution: the message view now positions the complete verdict at the top before the explanation. The retained validation screenshot confirms the verdict code and all evidence boundaries are visible.

### E2E-08-03 — Local completion run silently reused stale services

Severity: high

Resolution: Playwright now starts fresh API and fixture processes by default. Intentional debugging reuse requires `PLAYWRIGHT_REUSE_SERVERS=true` and is explicitly disallowed as completion evidence. The delivery harness also records the least-privilege escalation rule learned during diagnosis.

## Review result

Result: passed. No unresolved blocker or high-severity findings remain. The final `npm run verify` completed with 89 deterministic tests and 22 Chromium workflows without external services or Google credentials.
