# Resumable non-publishing API workflow

Change record version: 2

Issue: `.scratch/workflow-automation/issues/07-api-workflow-orchestration.md`

## Summary

Added a durable Google workflow API that prepares and plans a managed workspace,
resumes idempotent application, validates fresh state, creates an immutable version,
and stops before approval or publication. Opt-in owner-only refresh-token persistence
lets that workflow survive API restarts after one consent.

## Why

The guarded workflow stages existed independently but could not be run or resumed as
one operational path. Wiring them to the durable operation repository removes manual
handoffs while retaining the exact publication boundary.

## Behavior

Planning and resume endpoints now persist every transition and return structured
blocked or paused evidence. Equivalent planning requests reuse their operation, and a
versioned retry performs no additional writes. OAuth publication consent is decoupled
from publication execution, which remains disabled without its separate exact flag.
Publication, rollback, and visible extension controls are unchanged and out of scope.
Both navigation and confirmed lead-form proposals use the same runner. Generated
import notation is converted and compared with Google REST notation deterministically,
so casing and field aliases do not create false conflicts while real ownership and
semantic conflicts still stop mutation.

## Regression coverage

`apps/api/src/workflow-runner.test.ts` covers the complete path, durable replay,
partial-application resumption, conflict refusal, missing identities, and absence of
publication. `apps/api/src/google-oauth-persistence.test.ts` covers secure persistence,
restart restoration, client binding, unsafe permissions, and revocation. Google OAuth
and preflight tests cover separate scope consent and execution flags.
Change-plan and Google application tests cover import/REST equivalence, post-alias
ordering, exact REST payloads, trigger-ID remapping, and repeated convergence.
Application coverage also caps account-wide discovery at one call per resume while
retaining bound container, workspace, fingerprint, and entity re-reads per action.
Google client coverage proves quota-limited requests wait and retry without broadening
the requested action.

## Verification

`npm run verify` passed 194 deterministic tests across 29 files and all 25 Chromium
workflows. The separately credentialed disposable-container run persisted OAuth across
an API restart, recovered owned trigger `6` and tag `7` idempotently, passed GTM
validation with two expected changes and no errors, and created immutable version `3`
at fingerprint `1787458659661`. It retained prior-live version `2` at fingerprint
`1786828091962`, replayed without another Google action, and stopped at
`await_approval` with publication disabled.

## Exploratory review

This is an internal API surface with no new visible extension controls, so the visual
happy/negative/adversarial Chromium review is not applicable. The separately gated
credentialed smoke test exercises the API against only the marked disposable container.
Immutable version `3` was opened in Chromium for practitioner inspection; no extension
UI changed in this slice.

## Documentation

Added `docs/engineering/resumable-api-workflow.md`, updated current capabilities, and
extended the workflow-automation specification and issue.
