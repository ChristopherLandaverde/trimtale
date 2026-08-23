# Resumable non-publishing API workflow

The Google workflow API connects the existing durable tracking-operation record to the
guarded GTM planner, workspace application, validation, and immutable-version stages.
It deliberately stops at `versioned`; approval and publication remain separate actions.

## Configuration

The workflow uses the same explicit Google OAuth and write enablement as managed
workspace preparation. Set `GOOGLE_OAUTH_TOKEN_STORE` to opt into owner-only local
refresh-token persistence; the store contains no access token, is written atomically
with mode `0600`, is bound to the configured OAuth client, and is removed when Google
rejects the refresh credential. This permits API restarts without another browser
consent. `GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true` may include publication consent
in that one-time authorization without enabling publication execution.

Durable operation records default to
`.data/tracking-operations.json`; `TRACKING_OPERATION_STORE` may set an alternate
backend-local path. The file repository writes atomically with mode `0600`.

## API

`POST /api/google/workflows/plan` accepts either the same navigation `SetupRequest` as
`POST /api/setups` or an already-confirmed `FormSetupRequest`. It generates the setup,
creates or reuses the marked managed workspace when necessary, reads fresh workspace
entities, records the semantic plan, and returns the durable operation. Equivalent
requests reuse the operation identity.

`POST /api/google/workflows/{operationId}/resume` advances the persisted operation
through the safe stages available from its current state:

```text
planned -> applying -> applied -> validated -> versioned -> await approval
```

The runner persists `applying` before entity writes and persists completed action
signatures after an interrupted or partially failed application. A retry re-reads GTM
state and converges through the idempotent application client. Planning conflicts,
ownership ambiguity, stale fingerprints, sync conflicts, validation failures, and
version failures stop with structured evidence.

Application establishes unique public-ID recognition once per resume. Before every
entity action it then re-reads the operation-bound container path, exact marked
workspace, current fingerprint, and all supported workspace entities. This retains
fresh-state and ownership checks without repeatedly enumerating every accessible GTM
account, keeping one ordinary workflow below Google's per-user query-rate limit.

If Google still returns HTTP 429 during a larger validation/version sequence, the
client honors `Retry-After` or waits through a conservative 65-second quota window,
then retries the same request up to two times. The surrounding operation remains
idempotent and publication remains unreachable.

`GET /api/google/workflows/{operationId}` returns the current durable record.

All workflow routes use the exact extension-origin CORS boundary. They require the
container-write OAuth scopes, but never call approval, publication, rollback, or
post-publication methods. Creating an immutable version removes its source GTM
workspace in the ordinary GTM lifecycle, so a completed operation resumes at the
version-review boundary rather than trying to reuse the removed workspace.

## Publication boundary

Version creation is not publication. A versioned operation contains the immutable new
fingerprint and the prior-live path and fingerprint. A separate human decision must
bind approval to that exact new fingerprint before the publication client can be used.
The workflow API has no publication route. `GOOGLE_GTM_PUBLICATION_ENABLED` remains
false during the workflow even when publication scope was granted for later use.
