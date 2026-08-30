# Resume setup operation from assistant

Status: resolved

Blocked by: 01, 02

## Objective

Let a practitioner resume an interrupted tracking setup operation from the assistant
without duplicating owned GTM entities, managed workspaces, or immutable versions.

## Regression contract

Add deterministic tests covering:

- Reloading or reopening the assistant finds the latest operation state for the current
  confirmed setup and recognized container.
- Clicking **Resume** after partial application replays only incomplete actions.
- Clicking **Resume** after version creation returns the same version evidence and does
  not call Google mutation endpoints again.
- A missing operation, stale plan, stale workspace, revoked OAuth grant, and quota
  response produce bounded blocked states.
- The E2E happy path proves persistence across assistant close/reopen.

## Notes

Prefer an explicit persisted operation identifier over trying to reconstruct identity
from chat transcript text. Never use browser cookies or Google web-login state.

Resolved for the current setup-operation workflow. The assistant stores the operation
ID for a confirmed setup/container pair, re-reads versioned operation detail after
reopening the same setup, replaces stale operation cards on resume, resumes a partially
applied operation to version creation without leaving duplicate controls, and renders
stale workspace, stale plan, ownership conflict, synchronization conflict, inaccessible
container, validation failure, and publication-disabled blocks with bounded guidance.
