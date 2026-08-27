# Report provider operation progress

Delivery mode: implementation
Status: resolved

## Decision

Long Google work records one provider attempt inside the existing durable tracking
setup operation. It does not create a second job or persistence path. The attempt has:

- A unique attempt ID and one of the provider stages `planning`, `application`,
  `validation`, `versioning`, `publication`, or `rollback`.
- `started`, `failed`, or `completed` durable status.
- Start and update timestamps.
- A bounded safe failure code when failed; never a raw provider response.

Only one started provider attempt may exist for an operation. The visible provider
progress combines that durable attempt with the backend's bounded live-request
registry:

- `in_flight`: the started attempt matches one live backend request.
- `reconciling`: the attempt is started but no matching request is alive, including
  after backend restart. Fresh provider state must be read before another mutation.
- `failed`: the durable attempt contains a provider failure.
- `awaiting_user`: no attempt is active and the durable operation is at an approval,
  Preview, or live-verification checkpoint.
- `completed`: the stage's durable operation checkpoint is complete.

A browser display timeout is a local presentation annotation. It cannot change the
provider progress, mark failure, or enable retry. Reload reads the existing operation
and progress; it does not resume by issuing a mutation. A duplicate action for the
same active attempt returns current progress and makes zero provider calls.

## Visible contract

The website agent displays the exact stage, state, and safe elapsed-time wording. Retry
is unavailable for `in_flight`, `reconciling`, and `awaiting_user`. A failed attempt may
offer a retry only when the durable operation's next step and fresh provider state both
permit it. Progress copy never treats elapsed time as evidence of success or failure.

The API projection is versioned and contains no OAuth token, provider payload, account
email, raw exception, or private page data.

## Non-goals

- Changing Google quota behavior or provider semantics.
- Parallel mutation requests.
- Treating elapsed time as success or failure.
- Adding a second persistence path.
- Starting background mutation work merely because a progress endpoint was read.
- Allowing the browser to invent or advance a provider stage.

## Regression contract

- `tests/acceptance/provider-operation-progress.json` defines all six stages plus
  active, timed-out, reloaded, reconciling, failed, approval-wait, and completed cases.
- `packages/core/src/provider-progress-acceptance.test.ts` validates the fixture shape,
  while `packages/core/src/provider-progress.test.ts`, the operation and runner suites,
  and the Chromium workflow consume its runtime invariants.
- Reload, progress reads, and duplicate active actions must record zero additional
  provider calls. Unknown stages, malformed attempts, and raw provider errors fail
  schema validation.

## Authorization

The user explicitly authorized production implementation on 2026-08-27. The authorized
boundary is one attempt on the existing operation, a safe API projection, exact UI
stages, and retry locking. It excludes background mutation, parallel provider calls,
elapsed-time verdicts, and a second persistence store.

## Comments

- 2026-08-26: Real no-change validation and version creation each outlasted the
  browser harness's display wait while the single backend operation continued safely.
- 2026-08-27: Resolved the durable attempt and visible projection model. ADR 0005 keeps
  provider progress on the tracking setup operation and requires reconciliation rather
  than retry after a process restart.
- 2026-08-27: Implemented durable attempts for all six provider stages, the read-only
  projection endpoint, duplicate/restart locking, and website-agent progress wording.
