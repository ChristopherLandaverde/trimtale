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
| `GOOGLE_OAUTH_TOKEN_STORE` | Enables owner-only refresh-token persistence across backend restarts. |
| `TRACKING_OPERATION_STORE` | Selects the durable operation collection; defaults under `.data/`. |
| `GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true` | Includes publish scope during one-time consent without enabling publication. |
| `GOOGLE_GTM_PUBLICATION_ENABLED=true` | Makes guarded publish and rollback methods reachable for one approved session. |

Run `npm run preflight:google` before credentialed planning and
`npm run preflight:publication` before an approved publication session. Keep
publication disabled during ordinary planning, application, validation, and version
review.

The token store persists only the refresh token, binds it to the configured OAuth
client, writes atomically with mode `0600`, and deletes itself if Google rejects the
refresh credential. A repeated browser login should be necessary only after revocation,
OAuth-client replacement, missing newly required consent, or token-store loss.

## Durable workflow

The supported orchestration routes are:

- `POST /api/google/workflows/plan`
- `POST /api/google/workflows/{operationId}/resume`
- `GET /api/google/workflows/{operationId}`

The ordinary progression is:

```text
planned -> applying -> applied -> validated -> versioned -> await approval
```

Planning accepts navigation setup input or a confirmed lead-form specification. It
creates or reuses the marked managed workspace, compares generated entities
semantically, and records create, reuse, no-op, or conflict actions. Resume persists
`applying` before writes and can reconcile an interrupted create from freshly read GTM
state without duplicating the entity.

The workflow routes deliberately stop at version review. The current server exposes
no public approval, publication, rollback, or post-publication-evidence route; those
backend domain/client methods require a separate product slice before the extension can
operate them.

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
- a `browser_verified` verdict with platform confirmation still `unverified`.

GA4 commonly transports the standard `page_location` field as `dl`, not
`ep.page_location`. Normalize both representations to the same semantic requirement
and remove query parameters before persisting evidence.

Only passing evidence completes the operation. A genuine non-passing run records the
evidence and prepares the exact prior-live rollback target. An incomplete synthetic
diagnostic should remain diagnostic rather than being persisted as a completed journey.

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

## First live operation handoff

The disposable exercise used container `GTM-PCJ3Q5RK` only:

- Managed trigger: `6`, `Form success - data_layer_event`.
- Managed tag: `7`, `GA4 Event - generate_lead`.
- Published version: `3`, fingerprint `1787458659661`.
- Rollback version: `2`, fingerprint `1786828091962`.
- Operation: `operation_spec_disposable_form_smoke_v3`.
- Current state: `published`; no rollback required.

The live tag-signal smoke passed with one exact `generate_lead` request. The disposable
page currently lacks `#workflow-smoke-form`, so a real form interaction has not yet
produced the post-publication evidence required for `completed`. That is the first
operational task in the August 24 roadmap.

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
| Browser request passes but GA4 is not confirmed | Keep platform confirmation `unverified` until destination-side evidence exists. |

## Related documentation

- [Resumable API workflow](./resumable-api-workflow.md)
- [Approved publication and rollback](./approved-publication-rollback.md)
- [Managed workspace](./managed-gtm-workspace.md)
- [August 24 roadmap](../product-plan/2026-08-24-roadmap.md)
- [Live page-location review](../reviews/2026-08-23-ga4-page-location-wire-alias.md)
