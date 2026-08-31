# Assistant Setup Operation

Status: resolved

## Objective

Expose the existing resumable automation API in the website assistant so a tracking
practitioner can turn a confirmed tracking specification into a durable tracking setup
operation that prepares the managed workspace, applies owned GTM entities, validates
the workspace, creates an immutable version, publishes it only after exact fingerprint
approval, and stops before browser verification or platform confirmation.

## User outcome

A practitioner opens the site-aware analytics assistant, confirms a navigation-click
or lead-form tracking specification, and chooses **Prepare GTM version**. The assistant
shows one operation timeline:

```text
Confirmed specification
  -> Managed workspace prepared
  -> Tracking change plan reviewed
  -> Owned entities applied
  -> Workspace validated
  -> Immutable version created
  -> Awaiting publication approval
  -> Published approved version
  -> Awaiting browser verification
```

The practitioner can close and reopen the assistant without losing progress. If the
operation blocks, the assistant reports the precise reviewable state without retrying
dangerous actions, choosing a different container, resolving workspace conflicts, or
publishing. Publishing requires a versioned operation, current backend publication
enablement, publication OAuth scope, and the exact immutable version fingerprint shown
to the practitioner.

## Product boundaries

- The assistant may create or resume exactly one tracking setup operation from a
  confirmed tracking specification and recognized container.
- The assistant may display the operation status, managed workspace name, change-plan
  summary, validation result, version fingerprint, and prior live version fingerprint.
- The assistant must keep setup generation, GTM runtime observation, GTM access,
  workspace preparation, entity application, validation, versioning, publication
  approval, publication, browser verification, and platform confirmation as separate
  evidence stages.
- The assistant may publish only from `await_approval` by submitting the exact
  immutable version fingerprint to the backend approval/publish route.
- The assistant must not request publication scope, publish a mismatched or stale
  fingerprint, roll back, or imply that browser verification or platform confirmation
  passed.
- Operation creation must require container-write access. Read-only, disconnected,
  unconfigured, inaccessible, ambiguous, multiple-container, capacity-blocked,
  ownership-conflict, synchronization-conflict, stale-workspace, stale-plan, and quota
  states must be visible and non-destructive.
- Raw Google errors, credentials, OAuth tokens, cookies, form values, arbitrary page
  text, and private model/evaluation data must not enter the assistant transcript,
  generated setup, operation persistence, or logs.

## Flow

1. The assistant renders **Prepare GTM version** only after a tracking specification is
   confirmed, setup generation has passed, one recognized container is available, and
   effective access includes container writes.
2. Clicking the action sends the confirmed setup payload to the local workflow API.
3. The backend returns or creates one durable tracking setup operation.
4. The assistant renders the operation timeline from persisted operation state, not
   transient chat state.
5. If the operation is interrupted, reopening the assistant or clicking **Resume**
   re-reads the operation and asks the backend to resume from current Google state.
6. When the backend reaches a versioned state, the assistant displays the immutable
   version fingerprint, prior-live fingerprint, validation evidence, and a disabled
   publication step labelled as requiring separate approval.
7. The practitioner can choose **Publish `<fingerprint>`** only from the versioned
   operation card.
8. The backend approves and publishes only that exact fingerprint, then returns the
   published operation.
9. The assistant displays publication separately from browser verification and
   platform confirmation.
10. Blocked states show the blocking reason and the safest next practitioner action.

## Acceptance criteria

- [x] A confirmed navigation-click setup can start one tracking setup operation from
      the assistant and reach `await_approval` in deterministic E2E fixtures.
- [x] A confirmed lead-form setup can start one tracking setup operation from the
      assistant and reach `await_approval` in deterministic E2E fixtures.
- [x] Reopening the assistant displays the latest operation state from durable API
      storage, not from in-memory conversation state.
- [x] Resume is idempotent: repeated clicks do not duplicate GTM entities, create a
      second managed workspace, or create a second version after the operation is
      already versioned.
- [x] Publication requires exact immutable version fingerprint approval and does not
      run from non-versioned, stale, or mismatched operation state.
- [x] Read-only, disconnected, inaccessible, ambiguous, and multiple-container states
      do not render an operation-start action.
- [x] Capacity, ownership, synchronization, stale-workspace, stale-plan, validation,
      and quota blocks are visible, bounded, and non-destructive.
- [x] The assistant never publishes and never labels the setup as platform-confirmed.
- [x] Permanent unit and E2E regression coverage runs in the ordinary harness.
- [x] A reviewed Chromium report records the happy path, one negative/blocked path,
      and one adversarial page state.
- [x] `npm run verify` passes.

## Out of scope

- Rollback from the assistant.
- Real Google live-write E2E in ordinary verification.
- Model-backed operation decisions.
- Multi-destination proof, GA4 DebugView receipt, Meta CAPI, or WooCommerce purchase
  proof.
- Background scheduled monitoring or alerts.
