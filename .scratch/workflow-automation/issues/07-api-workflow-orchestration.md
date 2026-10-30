# Expose resumable non-publishing workflow orchestration

Status: resolved

Blocked by: 06

## Objective

Expose one durable API workflow that prepares the managed workspace, plans and applies
the generated setup idempotently, validates the exact workspace, and creates an
immutable version before stopping for explicit publication approval.

## Regression contract

`apps/api/src/workflow-runner.test.ts` covers the complete prepare-to-version path,
durable replay without duplicate writes, resumption after a partial application,
conflict refusal, missing-operation refusal, and the absence of publication calls.
`apps/api/src/google-oauth-persistence.test.ts` covers owner-only atomic refresh-token
persistence, restart restoration, client binding, permissive-mode refusal, and revoked
credential removal. `apps/api/src/google.test.ts` proves publication consent is
separate from publication execution.
`packages/core/src/change-plan.test.ts` and
`apps/api/src/google-application.test.ts` cover import-to-REST semantic equivalence,
post-alias deterministic ordering, REST write payloads, and convergence after Google
assigns entity identifiers. The application regression also proves one account-wide
discovery per resume rather than one per entity.
`apps/api/src/google.test.ts` covers automatic quota backoff and retry without changing
the requested Google operation.
`apps/api/src/cors.test.ts` keeps every workflow route behind the exact extension-origin
boundary.

## Comments

- 2026-08-22: Claimed after credentialed discovery and managed-workspace smoke checks
  passed against the explicitly disposable `GTM-XXXXXXX` container. The orchestration
  endpoint will stop at `versioned`; approval and publication remain separate.
- 2026-08-22: Expanded the operational slice to support a one-time full-scope consent
  with opt-in owner-only refresh-token persistence. This removes restart prompts while
  keeping publication execution disabled until exact approval.
- 2026-08-22: Credentialed planning exposed the expected legacy navigation ownership
  conflict and a false `PAGE_URL`/`pageUrl` conflict. The runner now accepts confirmed
  form proposals and canonicalizes import versus REST notation without adopting the
  unowned navigation entities. A corrected live resume is pending Google per-user query
  quota reset; no action signature was recorded as completed.
- 2026-08-22: Repeated live resumes proved the prior per-entity account enumeration
  deterministically exceeded Google's per-user query limit. Application now recognizes
  uniquely once, then re-reads the bound container/workspace/entities before each
  action. Focused application, validation, workflow, and type gates pass.
- 2026-08-23: The complete apply/validate/version sequence can still cross the per-user
  minute window. The Google client now honors `Retry-After`, falls back to a conservative
  65-second wait, and retries the same idempotent request twice before surfacing 429.
- 2026-08-23: Credentialed smoke operation
  `operation_spec_disposable_form_smoke_v3` reused the already recovered owned trigger
  and tag, passed validation with two expected changes and no errors, created immutable
  version `3` at fingerprint `1787458659661`, retained prior-live version `2` at
  fingerprint `1786828091962`, and stopped at `await_approval`. Replay returned the
  same version without additional Google work. Publication remained disabled.
- 2026-08-23: Final `npm run verify` passed 194 deterministic tests and all 25 Chromium
  workflows before the credentialed run. A final post-evidence gate is recorded in the
  change record.

## Answer

The backend now exposes one durable, restart-safe workflow for navigation and confirmed
lead-form setups. It plans and applies only in the marked workspace, reconciles Google
import/REST representations, automatically backs off on quota responses, validates
fresh state, creates an immutable version, and stops for exact approval. OAuth consent
survives restarts through an opt-in owner-only refresh-token store, while publication
execution remains a separate disabled boundary.
