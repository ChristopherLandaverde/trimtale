# Real Google disposable workflow review

Date: 2026-08-31

Branch: `codex/resume-blocked-workflow`

Environment: local API at `http://127.0.0.1:18787` using the owner-provided Google
OAuth client and persisted local token store. No credential payloads, tokens, cookies,
or secrets were printed or recorded.

## Scope

This review exercised the Phase 1 real-Google disposable workflow lanes against the
documented disposable GTM container. The dry-run lane stopped at immutable version
creation. After owner approval for exact fingerprint `1788183353134`, the approved
publication smoke published that same disposable version and recorded browser
verification evidence.

## Credential and safety state

`/api/google/status` reported:

- `configured: true`
- `connected: true`
- `scope: container-edit`
- `containerWritesEnabled: true`
- `publicationScopeRequested: false`
- `publicationEnabled: false`
- `tokenPersistenceEnabled: true`

Accessible-container discovery found exactly one match for `GTM-PCJ3Q5RK`:

- Account: `Premium Carpet Company Test`
- Container: `ConsentFlow Verification`
- Path: `accounts/6305900974/containers/261236292`

The prior live version before this dry run was:

- Path: `accounts/6305900974/containers/261236292/versions/6`
- Fingerprint: `1787798811643`

## Operation

Planned and resumed form setup operation:

- Operation: `operation_spec_disposable_form_smoke_2026_08_31_dry_run`
- Specification: `spec_disposable_form_smoke_2026_08_31_dry_run`
- Measurement ID: `G-YV879ECLRV`
- Target page: `https://consentflow-psi.vercel.app/`
- Target selector: `#workflow-smoke-form`
- Success evidence: `gtm_observability_smoke_success`
- Event: `generate_lead`

The operation used managed workspace:

- Path: `accounts/6305900974/containers/261236292/workspaces/9`
- Fingerprint: `1788183087898`

Resume reached the approval gate:

- Status: `versioned`
- Validation: `passed`
- Immutable version path: `accounts/6305900974/containers/261236292/versions/7`
- Immutable version fingerprint: `1788183353134`
- Next step: `await_approval`

No approval, publication, browser-verification evidence, or rollback was recorded.

## Result

Result: pass for the disposable dry-run lane.

The workflow reached `versioned` with publication disabled. This confirms the product
can continue through planning, owned GTM workspace application, validation, and
immutable version creation against the disposable Google container. Platform
confirmation remains unavailable by design.

## Approved publication smoke

Owner approval was given after the dry run reached `versioned`. The API session was
restarted with:

- `GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true`
- `GOOGLE_GTM_PUBLICATION_ENABLED=true`

Publication preflight passed with OAuth client configuration, callback, extension
origin, container writes, token persistence, publication OAuth scope, and publication
execution enabled.

The product publish route accepted only the approved immutable version fingerprint:

- Operation: `operation_spec_disposable_form_smoke_2026_08_31_dry_run`
- Approved fingerprint: `1788183353134`
- Published at: `2026-08-31T13:52:25.577Z`
- Published fingerprint: `1788183353134`

Browser verification then loaded `https://consentflow-psi.vercel.app/` in Chromium,
submitted `#workflow-smoke-form` once, observed the visible success state, and posted
sanitized evidence:

- Evidence run: `run_spec_disposable_form_smoke_2026_08_31_dry_run_1788184399167`
- Raw matching GA4 requests observed: `1`
- Sanitized request host/path: `https://www.google-analytics.com/g/collect`
- Event: `generate_lead`
- Measurement ID: `G-YV879ECLRV`
- `form_id`: `workflow-smoke-form`
- `form_name`: `Disposable workflow smoke form`
- Page location was transported through GA4's `dl` parameter and normalized to
  `https://consentflow-psi.vercel.app/`.

The durable operation reached `completed` with browser verdict `browser_verified`.
Platform confirmation remained `unverified`; no GA4, Ads, reporting, attribution, or
other destination-side receipt was claimed.

Approved publication smoke result: pass.

## Rollback drill

The rollback drill started from live disposable version `7`, fingerprint
`1788183353134`. A fresh disposable operation was created to publish a distinct
version, then a controlled failed browser-verification run forced rollback approval.

Rollback drill operation:

- Operation: `operation_spec_disposable_form_smoke_2026_08_31_rollback_drill`
- Specification: `spec_disposable_form_smoke_2026_08_31_rollback_drill`
- Target page: `https://consentflow-psi.vercel.app/`
- Target selector: `#workflow-smoke-form`
- Success evidence: visible element `#workflow-smoke-success`
- Event: `generate_lead`

The operation used managed workspace:

- Path: `accounts/6305900974/containers/261236292/workspaces/10`
- Fingerprint: `1788185157115`

Resume reached the approval gate:

- Status: `versioned`
- Validation: `passed`
- Immutable version path: `accounts/6305900974/containers/261236292/versions/8`
- Immutable version fingerprint: `1788185422573`
- Prior live version path: `accounts/6305900974/containers/261236292/versions/7`
- Prior live fingerprint: `1788183353134`

After exact-fingerprint approval, the product published version `8`:

- Published at: `2026-08-31T14:10:57.886Z`
- Published fingerprint: `1788185422573`

Controlled failed browser verification loaded the live disposable page in Chromium,
submitted the form once, and blocked GA4 collection for the run. The visible success
state and data-layer success event were observed, but no GA4 collection request was
recorded:

- Evidence run:
  `run_spec_disposable_form_smoke_2026_08_31_rollback_drill_blocked_collect_1788185485815`
- Verdict: `tag_fired_request_missing`
- Browser verification: `failed`
- Platform confirmation: `unverified`

The durable operation moved to `rollback_required` and named exact rollback target
fingerprint `1788183353134`. Rollback was then approved only for that target and
completed:

- Rollback status: `completed`
- Rollback completed at: `2026-08-31T14:11:59.540Z`
- Restored live version path: `accounts/6305900974/containers/261236292/versions/7`
- Restored live fingerprint: `1788183353134`

Live container readback after rollback confirmed version `7`, fingerprint
`1788183353134`.

Rollback drill result: pass. No autonomous rollback occurred, and platform
confirmation remained unavailable.
