# Rollback gets the same separate approval and verified approver as publish

Status: resolved

GitHub: #71

## Objective

Rolling a container back to its prior live version needs the same deliberate steps as
publishing (#62): the typed container ID, a separate approve step, the verified Google
account email as approver, and a 30-minute freshness window. The constant
`approvedBy: "website assistant"` disappears from the rollback path.

## Regression contract

- `packages/core/src/publication.test.ts` — "binds a short-lived rollback approval to the
  recorded target and approver": exact target, trimmed approver, 30-minute window both
  ways, renewal, empty approver, wrong status, and schema refusal of a retargeted or
  anonymous rollback approval.
- `apps/api/src/workflow-runner.test.ts` — happy path (approve, then roll back, approver
  persisted), `confirmation_mismatch`, `rollback_fingerprint_mismatch`, missing
  approver, `approval_required`, `approver_changed`, `approval_expired` with no Google
  call and renewal, Google failure leaves the approval pending, wrong status.
- `apps/api/src/workflow-routes.test.ts` — "rollback approval and rollback routes":
  session account recorded and client approver ignored, missing or wrong typed ID, stale
  approval, changed account, unverified email (403), publication switch off (403, no
  identity call).
- `apps/extension/src/setup-operation-presenter.test.ts` and
  `apps/extension/src/workflow-bridge.test.ts` — review-before-rollback actions, approved
  state naming the approver, refusals routed back to rollback review without "Nothing was
  published", and the stored approved state.
- `tests/e2e/navigation-extension.spec.ts` — "rolls back a failed publication only after
  a typed confirmation and a separate approval request" and "sends a stale rollback
  approval back to rollback review instead of rolling back".

## Answer

Resolved by the `claude/71-rollback-approval` pull request. The runner splits
`approveAndRollback` into `approveRollback` and `rollbackApproved`; the API exposes
`POST /api/google/workflows/:id/rollback-approval` and `POST .../rollback`, both behind
the publication switch and the verified session identity. The assistant shows a
**Review rollback** confirmation, then a separate **Roll back to <target>** action.
