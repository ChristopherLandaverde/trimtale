# Connected verification evidence exploratory review

Date: 2026-08-23

Build: `feat/connected-verification-evidence` production extension before final commit.

## Environment

- Playwright Chromium 1234 with the unpacked production extension.
- Deterministic loopback fixtures for exact connected context, delayed GA4 browser
  requests, read-only Realtime count changes, provider denial, and attacker-shaped
  authorized resource names.
- Isolated credentialed Chromium against `https://consentflow-psi.vercel.app/`, exact
  disposable container `GTM-PCJ3Q5RK`, measurement ID `G-YV879ECLRV`, and the saved
  mode-0600 OAuth grant.
- GTM writes and publication were explicitly disabled. Analytics used Admin and Data
  API reads only. No browser cookies, tokens, form values, or raw Google bodies were
  inspected or rendered.

## Scenarios

### Exact connected happy path

Removed both proprietary setup meta tags from the fixture page, opened the assistant,
and confirmed a lead-form specification. Exact GTM inspection supplied account,
container, public ID, container ID, and one measurement ID. Setup generation passed,
the guided run recorded a Realtime baseline, one delayed but complete GA4 request
passed browser verification, and a count change from 4 to 5 passed platform
confirmation.

The evidence path retained all eight rows and updated Browser verification and Platform
confirmation in place. Its platform copy says the result is aggregate correlation with
no user-level or event-level identity. The submitted private sentinel never appeared.

Visual evidence:
[`connected-verification-evidence-linux.png`](../../tests/e2e/connected-verification-evidence.spec.ts-snapshots/connected-verification-evidence-linux.png)

### Provider denial and adversarial names

Returned a safe `provider_forbidden` code with a private raw-detail sentinel and used
markup-bearing account/container names. The names rendered as literal inert text; no
`img` or `script` node was created. The UI said the Analytics Data API or saved grant
was unavailable, omitted the raw detail, kept the platform row failed, and still let
the guided browser run pass independently.

### Live disposable destination

The pre-chat card resolved the exact live account/container and `G-YV879ECLRV` with
Analytics reads enabled. Generation passed without proprietary page meta tags. A first
live review exposed a 1.2-second observation cutoff: the page success state appeared
but the later GA4 request missed the verdict window. The product now waits a bounded
five seconds only when no deterministic fixture state or request is available; a
permanent delayed-request journey protects the fix.

After the fix, one synthetic submission produced visible success and passed browser
verification. A separate sanitized network diagnostic observed HTTP 204 for the
`generate_lead` collection request with the exact measurement ID, `form_id`,
`form_name`, and standard `dl` page location. The Analytics Data API was enabled during
the review and the exact property/data-stream mapping succeeded.

GA4 Realtime still returned an aggregate count of zero for both `generate_lead` and
`page_view` several minutes after accepted collection responses. A final unfiltered
Realtime report returned `rowCount: 0`, proving this is property-wide ingestion rather
than the product's exact event-name filter. The assistant kept platform confirmation
pending and made no false claim.

## Findings

1. High, resolved in code: live GA4 collection can arrive after the former fixed
   1.2-second browser-verdict snapshot. A bounded five-second metadata-only observation
   window now waits for the request; deterministic known states remain prompt.
2. Medium, resolved: every upstream HTTP 403 was labeled as the local Analytics read
   gate. Safe backend error codes now distinguish local disablement from provider/API
   denial without exposing raw response bodies.
3. Low, resolved: repeated evidence resizing could drift the assistant width by one
   border pixel. The resize observer now persists client dimensions, and the evidence
   journey asserts no horizontal message overflow. Candidate and connection visuals
   passed three consecutive runs after baseline review; the refresh glyph permits a
   50-pixel antialias allowance without weakening layout/content assertions.
4. High, open external evidence: the disposable GA4 property has not surfaced accepted
   browser collection in Realtime. The product correctly remains pending, but the live
   platform-pass acceptance criterion requires a later count increase or an identified
   destination-side cause.

## Result

Deterministic happy, delayed, negative, and adversarial paths are green and the exact
live workflow passes setup generation plus browser verification. Issue 23 remains
active until the disposable GA4 destination produces the aggregate Realtime increase
or the destination-side ingestion blocker is resolved. No unsafe write, secret
exposure, false platform pass, or unresolved code-level blocker was observed.
