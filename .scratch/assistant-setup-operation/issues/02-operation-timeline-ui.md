# Render durable setup operation timeline

Status: resolved

Blocked by: 01

## Objective

Render the persisted tracking setup operation as a visible assistant timeline that
separates workspace preparation, planning, application, validation, immutable version
creation, publication approval, browser verification, and platform confirmation.

## Regression contract

Add unit and E2E coverage for:

- Each durable operation state rendering the correct evidence stage and no premature
  success claim.
- Versioned operations displaying immutable version fingerprint and prior-live
  fingerprint while stopping at `await_approval`.
- Blocked states showing bounded practitioner guidance for capacity, ownership,
  synchronization, stale-workspace, stale-plan, validation, and quota cases.
- Account, container, workspace, validation, and version text rendering as inert text.
- Visual baselines for the ready, blocked, and approval-awaiting states.

## Notes

The assistant should read operation state from the backend response or detail endpoint.
Conversation state may trigger the action, but it must not become the source of truth.

Resolved for the assistant setup-operation matrix. The workflow now renders versioned,
published, partial-resume, validation-blocked, workspace capacity, ownership,
synchronization, stale workspace, stale plan, inaccessible container, and publication
blocked states with bounded guidance and no platform-confirmed claim.
