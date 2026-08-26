# GTM setup workflow operator runbook

## Purpose

This runbook preserves the safe path from a confirmed tracking specification through
Google Tag Manager planning, application, validation, immutable version creation,
exact approval, publication, browser evidence, and rollback. It also records lessons
from the first credentialed disposable-container exercise.

Real Google work is always separate from ordinary `npm run verify`. Use a disposable
container unless the user explicitly identifies and authorizes another exact target.

## Safety boundary

- Match the public GTM ID observed on the website to exactly one accessible container.
- Use only the custom workspace named `GTM Observability` with the exact ownership
  marker. Never edit the default workspace or an unmarked entity.
- Keep container writes and publication behind separate backend flags.
- Bind publication approval to one immutable version fingerprint and one recorded
  prior-live fingerprint.
- Treat browser verification and platform confirmation as different evidence states.
- Never print or commit OAuth credentials, refresh tokens, or live operation stores.

## Configuration and readiness

The backend requires an OAuth client ID, client secret, and the exact local callback
`http://127.0.0.1:8787/api/google/oauth/callback`. CORS separately requires the exact
installed extension origin; a wildcard or a different extension ID fails closed.

Use these controls deliberately:

| Setting | Purpose |
|---|---|
| `GOOGLE_GTM_CONTAINER_WRITES_ENABLED=true` | Allows guarded container and workspace changes. |
| `GOOGLE_GTM_WRITE_TARGET_PUBLIC_ID` | Rejects every GTM mutation outside one exact public container ID. |
| `GOOGLE_OAUTH_TOKEN_STORE` | Enables owner-only refresh-token persistence across backend restarts. |
| `TRACKING_OPERATION_STORE` | Selects the durable operation collection; defaults under `.data/`. |
| `GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true` | Includes publish scope during one-time consent without enabling publication. |
| `GOOGLE_GTM_PUBLICATION_ENABLED=true` | Makes guarded publish and rollback methods reachable for one approved session. |
| `GOOGLE_ANALYTICS_READS_ENABLED=true` | Enables read-only Analytics Admin and Realtime verification; it does not enable GTM or GA4 writes. |
| `GOOGLE_ANALYTICS_WRITES_ENABLED=true` | Requests Analytics edit consent and permits only the reviewed enhanced-measurement master switch. |

Run `npm run preflight:google` before credentialed planning and
`npm run preflight:publication` before an approved publication session. Keep
publication disabled during ordinary planning, application, validation, and version
review.

For the disposable Stage 1 end-to-end lane, run:

```bash
npm run smoke:google:stage1
```

This explicit command builds the product, starts the saved authenticated backend,
loads the production extension in a persistent headed Chromium profile, and opens the
ConsentFlow target. It enables publication only for that process, locks all GTM
mutations to `GTM-PCJ3Q5RK`, and stops unless the extension origin, exact website
origin/path/query, sole observed GTM ID, fresh provider recognition, and exact
`G-YV879ECLRV` destination match. The profile is retained under
`.data/stage1-google-smoke-profile` so the supported human Google and Tag Assistant
session can survive restarts. The launcher explicitly disables Analytics writes even
if its parent shell enabled them for another session. Closing Chromium stops the
backend.

Keep Analytics writes off for ordinary sessions. For an approved session, start the
saved launcher with `GOOGLE_ANALYTICS_WRITES_ENABLED=true npm run google -- api`, then
open `/api/google/oauth/start` to grant the added scope. The launcher reuses the saved
client configuration; the visible review remains required before any PATCH.

The token store persists only the refresh token, binds it to the configured OAuth
client, writes atomically with mode `0600`, and deletes itself if Google rejects the
refresh credential. A repeated browser login should be necessary only after revocation,
OAuth-client replacement, missing newly required consent, or token-store loss.

## Durable workflow

The supported orchestration routes are:

- `POST /api/google/workflows/plan`
- `POST /api/google/workflows/{operationId}/resume`
- `POST /api/google/workflows/{operationId}/repair-draft`
- `POST /api/google/workflows/{operationId}/apply-repair`
- `GET /api/google/workflows/{operationId}`

The ordinary progression is:

```text
planned -> applying -> applied -> validated -> exact draft preview
  -> failed -> review bounded repair -> validated -> new exact draft preview
  -> draft_verified -> versioned -> await publication approval
```

Planning accepts navigation setup input or a confirmed lead-form specification. It
creates or reuses the marked managed workspace, compares generated entities
semantically, and records create, reuse, no-op, or conflict actions. Resume persists
`applying` before writes and can reconcile an interrupted create from freshly read GTM
state without duplicating the entity.

The extension exposes plan review and resume only after an exact pre-write
confirmation. An exact Tag Assistant browser run must bind the setup, workspace, and
quick-preview fingerprints before version creation. Publication controls remain
separate and require the exact immutable fingerprint. After publication, a second
browser run binds evidence to that live fingerprint. Only failed evidence exposes the
separate exact rollback review; inconclusive evidence keeps rollback locked.

A failed exact-draft run may request repair only while all three preview bindings are
current. Repair re-plans the unchanged generated setup against the same managed
workspace. A create or product-owned update must receive separate review before
application. Reuse/no-op-only, conflicting, ambiguous, stale, exhausted, and
intent-changing paths stop. Successful application is provider-validated and yields a
new workspace and quick-preview fingerprint; it never skips the next exact browser
run or creates a version directly.

## Approval, publication, and rollback

A publication approval:

- can be created only from a `versioned` operation;
- records the approver, approval time, and exact immutable fingerprint;
- expires after 30 minutes; and
- becomes unusable if the immutable version or current live version differs from the
  stored evidence.

Immediately before publication, re-read the immutable version and live container. The
Google publish request includes the immutable fingerprint guard, and the response must
return the same fingerprint without a compiler error. Persist publication evidence,
then independently re-read the live version.

Rollback is not “publish whichever old version looks right.” It requires the recorded
prior-live path and fingerprint, requires the failed new fingerprint to still be live,
and uses Google's fingerprint guard to restore exactly the recorded prior version.

## Post-publication evidence

Exercise the real confirmed website interaction. Do not replace a missing form or
success outcome with an injected event and then claim a complete journey. A passing
lead-form run requires:

- the confirmed interaction and successful outcome;
- the accepted success signal;
- the expected data-layer event;
- exactly one GA4 request;
- required `form_id`, `form_name`, and semantic `page_location`; and
- a `browser_verified` verdict independent of any platform state.

GA4 commonly transports the standard `page_location` field as `dl`, not
`ep.page_location`. Normalize both representations to the same semantic requirement
and remove query parameters before persisting evidence.

Only passing evidence completes the operation. A failed run records the evidence and
prepares the exact prior-live rollback target. The website agent then requires a
separate review and confirmation before the backend rechecks fresh Google state and
restores that fingerprint. Inconclusive evidence remains retryable and cannot unlock
rollback. An incomplete synthetic diagnostic should remain diagnostic rather than
being persisted as a completed journey.

### Optional read-only GA4 correlation

With Analytics reads explicitly enabled and the saved grant containing
`analytics.readonly`, the visible guided run can add ephemeral destination evidence:

1. Require exactly one GA4 measurement ID in the exact matched live GTM version.
2. Require that ID to match exactly one Analytics Admin property/data stream.
3. Record the expected event's Realtime count before enabling the submission.
4. Require browser verification to pass.
5. Re-read the same property/event and pass only after its aggregate count increases.

Equal counts remain pending; they are not failures and do not weaken browser evidence.
Verification handles expire after ten minutes and exist only in bounded process memory.
The comparison is aggregate timing correlation, not proof of which user or individual
event Analytics processed. Do not use it to expose form values, cookies, tokens, or
submitted personal information.

The Google Cloud project behind the OAuth client must have both Analytics Admin API and
Google Analytics Data API enabled. A provider denial is different from the local read
gate and should prompt an operator to check API enablement and the saved grant. The
product never renders Google's raw response body.

## Live-integration findings

### Query quota and backoff

The credentialed test project returned a 60-query-per-user-per-minute limit. Repeating
account-wide discovery before each entity action exhausted it quickly. Establish unique
public-ID recognition once per resume, then re-read only the operation-bound container,
managed workspace, fingerprint, and entities before each action.

Every Google request automatically handles HTTP 429. It honors `Retry-After` when
present; otherwise it waits a conservative 65 seconds and retries the same idempotent
request. There are three total attempts. Do not start parallel resumes to outrun the
quota: that increases reads and creates competing repository revisions.

### Workspace lifecycle and capacity

Standard GTM workspace capacity is three concurrent workspaces. Reuse the one marked
managed workspace and stop on ownership ambiguity or capacity exhaustion. Creating an
immutable container version consumes the source workspace in GTM's normal lifecycle;
a versioned operation must resume at version review rather than attempting to recover
that removed workspace.

### Google REST representation

Generated GTM import files and the v2 REST API use different spellings and casing for
several equivalent fields. Known examples include `measurementId` versus
`measurementIdOverride`, `eventParameters` versus `eventSettingsTable`, parameter
`name`/`value` versus `parameter`/`parameterValue`, built-in variable casing, and enum
casing. Compare canonical semantics, but construct outgoing bodies in Google's REST
representation. Omit empty default parameter collections when Google omits them.

Changing semantic canonicalization can make an older planned operation's signatures
stale. Stop and create a fresh plan rather than forcing an old signature through.

### Persistence and restart behavior

Refresh-token and operation files are backend-local, owner-readable, atomically
written, and ignored by Git under `.data/`. The refresh token removes repeated consent;
the operation record removes repeated setup actions. Neither file is a substitute for
backups, multi-process locking, or a production secret store/database.

The file repository uses optimistic `updatedAt` revisions. Avoid concurrent resume,
approval, publication, or evidence writers for the same operation until a production
repository provides transactional coordination.

### Boundary behavior

- CORS permits only the configured extension origin on integration routes.
- The API body limit is 256 KB.
- Google error bodies may contain structured objects; surface their message without
  logging tokens or entire credentials.
- OAuth publish consent and publication execution are intentionally independent.
- Ordinary CI uses fake Google responses and cannot mutate a live container.

### Delivery maintenance

The August 23 merged-main runs passed, but GitHub Actions warned that
`actions/checkout@v4` and `actions/setup-node@v4` target deprecated Node 20 while the
runner forces them onto Node 24. This is not blocking today. Upgrade those actions to
their current Node-24-compatible major versions before GitHub removes the compatibility
path, then rerun the full verification gate and inspect any checkout/cache differences.

Merged-main run `32619438610` also reported one flaky Chromium visual assertion. The
first `form-candidate-highlights.png` comparison differed by 3,293 pixels, or 1%, and
the Playwright retry passed without a code change. Treat this as unresolved timing or
rendering instability, not an approved visual change. Reproduce the candidate-highlight
journey repeatedly, inspect failure artifacts, and stabilize fonts/layout/capture timing
before considering any reviewed baseline update. The follow-up is tracked in
`.scratch/conversational-tracking-specs/issues/12-form-candidate-highlight-snapshot-flake.md`.

## First live operation handoff

The disposable exercise used container `GTM-PCJ3Q5RK` only:

- Managed trigger: `6`, `Form success - data_layer_event`.
- Managed tag: `7`, `GA4 Event - generate_lead`.
- Published version: `3`, fingerprint `1787458659661`.
- Rollback version: `2`, fingerprint `1786828091962`.
- Operation: `operation_spec_disposable_form_smoke_v3`.
- Evidence run: `run_spec_disposable_form_smoke_v3_1787493019725`.
- Current state: `completed`; no rollback required.

The live ConsentFlow page now includes `#workflow-smoke-form`. A real Chromium
submission observed the successful visible outcome, one metadata-only
`gtm_observability_smoke_success` event, and exactly one `generate_lead` request with
`form_id`, `form_name`, and production `page_location` transported as `dl`. The
normalized verdict was `browser_verified`; browser verification passed while platform
confirmation remained `unverified`. That passing evidence completed the operation
without invoking rollback.

## Recovery guide

| Symptom | Safe response |
|---|---|
| Backend restart asks for Google consent again | Confirm the same OAuth client and token-store path, file ownership/mode, token revocation, and whether new scopes were requested. |
| Google returns HTTP 429 | Let the built-in retry window finish; do not parallelize account discovery or restart the same action repeatedly. |
| Workspace or entity fingerprint changed | Stop, inspect ownership and fresh changes, and create/reconcile a new plan. |
| Plan reports human-owned name collisions | Rename or explicitly resolve the human-owned entity; never adopt it automatically. |
| Version exists but workspace disappeared | This is expected after version creation; resume at version review. |
| Publish approval is older than 30 minutes | Re-read the immutable and live versions and obtain a new exact-fingerprint approval. |
| Published signal fires but full journey cannot run | Fix or identify the real website target and success outcome; do not fabricate completion evidence. |
| Browser request passes but GA4 count is unchanged | Keep platform confirmation pending, allow the explicit retry, and retain the independent browser pass. Do not submit repeatedly merely to outrun Realtime latency. |
| Analytics Data API read is denied | Confirm the API is enabled for the OAuth project and the saved grant includes `analytics.readonly`; do not broaden to an edit scope. |

## Second live unpublished version review

On 2026-08-23, Playwright drove the visible ConsentFlow workbench through the current
plan, exact application confirmation, resume, validation, and version result:

- Operation: `operation_spec_form_workflow-smoke-form`.
- Plan: create `Form success - visible_element`, update managed
  `GA4 Event - generate_lead`, and retain `Page URL` unchanged.
- Validation: passed with zero compiler errors; preview fingerprint
  `1787537271064`.
- Immutable version: version 4, fingerprint `1787537272032`.
- Prior live: version 3, fingerprint `1787458659661`.
- Publication: no approval, publish, or rollback request occurred. A fresh container
  read confirmed version 3 remained live.

The run proves the workbench's credentialed application boundary. It does not prove
version 4's browser behavior because the version remains unpublished. Review its
visible-success trigger before any separate publication decision.

## Current credentialed workflow readiness

On 2026-08-25, read-only recognition matched the exact disposable container,
measurement destination, live version 3, and available managed-workspace capacity.
The `smoke:google:stage1` launcher then matched the configured extension, ConsentFlow
origin, and sole observed ID `GTM-PCJ3Q5RK`. No mutation occurred during that readiness
review.

Current launchers repeat this read-only recognition and require the exact GA4
destination before announcing readiness. A saved-session run passed that gate against
current Google state on 2026-08-26 without mutation.

This proves the lane is correctly configured and contained. It does not yet prove the
current website-agent-to-Tag-Assistant handoff, immutable version creation,
publication, or live verification. Those steps remain the next acceptance run.

## Related documentation

- [Resumable API workflow](./resumable-api-workflow.md)
- [Approved publication and rollback](./approved-publication-rollback.md)
- [Managed workspace](./managed-gtm-workspace.md)
- [August 24 roadmap](../product-plan/2026-08-24-roadmap.md)
- [Live page-location review](../reviews/2026-08-23-ga4-page-location-wire-alias.md)
