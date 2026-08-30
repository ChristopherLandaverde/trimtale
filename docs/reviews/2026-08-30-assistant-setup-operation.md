# Assistant setup operation exploratory review

Date: 2026-08-30

Build: working tree after assistant setup-operation implementation.

Environment: Playwright Chromium 1234, unpacked extension from `apps/extension/dist`,
local fixture at `http://127.0.0.1:14173/`, local API at
`http://127.0.0.1:18787/`, verification target at `http://127.0.0.1:4175/`,
and deterministic intercepted Google/workflow responses. No real Google credentials
or GTM workspace were used.

## Scenarios exercised

### Navigation operation happy path

1. Loaded the fixture page with `GTM-TEST123`.
2. Confirmed a navigation-click setup through the assistant.
3. Selected `Check GTM access` and confirmed that the recognized writable container
   rendered `Prepare GTM version`.
4. Selected `Prepare GTM version`.

Observed: the assistant started the local workflow API, rendered a setup-operation
timeline, showed immutable version fingerprint `version-8`, showed prior live
fingerprint `live-7`, and stopped at publication approval with explicit copy that
nothing was published.

### Lead-form operation happy path

1. Loaded the fixture page with `GTM-TEST123`.
2. Confirmed the `Contact sales` form and reviewed the generated `generate_lead`
   setup.
3. Selected `Check GTM access` and then `Prepare GTM version`.

Observed: the assistant reached `await_approval`, displayed the prior live version
fingerprint, and kept platform confirmation unverified.

### Reopen and durable read

1. Started a navigation setup operation to version creation.
2. Closed the page and opened a new page in the same persistent Chromium profile.
3. Reconfirmed the same navigation setup and selected `Check GTM access`.

Observed: the assistant reloaded the operation from the workflow detail endpoint using
the stored operation ID and rendered the same immutable version evidence. Conversation
transcript text was not used as the source of truth.

### Negative and adversarial states

The existing no-measurement path still withholds generated setup and workflow actions.
The existing page-controlled target-label test still renders instruction-shaped label
content as inert text and leaves `window.__unsafeHighlightExecuted` unset.

## Visual review

The regenerated Darwin baseline
`tests/e2e/navigation-extension.spec.ts-snapshots/assistant-managed-workspace-darwin.png`
shows the recognized container, prepared managed workspace, new `Prepare GTM version`
control, and existing `Download GTM setup` control without overlap or a publication
claim.

## Findings

No blocker or high-severity findings remain for the assistant-start workflow.

Follow-on coverage is still required for partially applied resume states and the full
blocked-state matrix: capacity, ownership conflict, synchronization conflict,
stale workspace, stale plan, validation failure, quota, and revoked OAuth grant.

## Review result

Result: passed for the assistant operation-start workflow through immutable version
creation and approval boundary.

Publication approval, publication, rollback, live Google writes, and full blocked-state
recovery remain out of scope for this slice.
