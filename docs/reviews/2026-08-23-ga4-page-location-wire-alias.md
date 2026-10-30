# GA4 page-location wire-alias review

Date: 2026-08-23

Build: `fix/ga4-page-location-wire-alias` working tree before final commit.

Environment: Playwright Chromium 1234 against the published disposable container
`GTM-XXXXXXX` on `https://consentflow-psi.vercel.app/`, plus deterministic core
regressions. No production container was used.

## Scenarios exercised

### Published generate-lead signal

Loaded the disposable page, waited for the exact GTM container runtime, and pushed the
confirmed `gtm_observability_smoke_success` data-layer signal. Chromium observed
exactly one GA4 `generate_lead` request for `G-XXXXXXXXXX`. It contained the expected
`form_id` and `form_name`, and transmitted the page URL through GA4's standard `dl`
wire parameter. The corrected semantic assertion passed.

### Missing page-location evidence

The deterministic negative case retains `form_id` and `form_name` but omits both `dl`
and `ep.page_location`. The verdict remains `missing_parameter`; accepting the wire
alias does not weaken the required-page-location invariant.

### Attacker-shaped page URL

The privacy regression supplies a private email sentinel in the query of a `dl` URL.
Normalization retains only the origin and pathname and excludes both the query value
and non-allowlisted parameters.

## Findings

### WIRE-08-01 — Standard page location was falsely reported missing

Severity: high

Resolution: the verdict now treats either `dl` or `ep.page_location` as evidence for
the required semantic `page_location`; evidence normalization allowlists and
query-redacts both spellings. Permanent positive, negative, and privacy regressions
cover the behavior.

### WIRE-08-02 — Disposable page has no workflow-smoke form element

Severity: low for this signal-level publication smoke; out of scope for the wire-alias
fix. The review did not fabricate an actual form submission or persist a completed
form-journey claim. The live GTM trigger/tag path was tested through its confirmed
data-layer success signal.

## Review result

Result: passed for the GA4 wire-alias correction and published tag-signal behavior.
No unresolved blocker or high-severity finding remains in this slice. The broader
operation remains `published` until a real target interaction supplies full
post-publication journey evidence.
