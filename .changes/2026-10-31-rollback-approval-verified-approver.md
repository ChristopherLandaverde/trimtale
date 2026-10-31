# Rollback approval with a verified approver

Change record version: 2

Issue: `.scratch/workflow-automation/issues/11-rollback-approval-and-verified-approver.md` (GitHub #71)

## Summary

Rollback now mirrors publication (#62): a typed container ID, a separate approve request
that records the Google-verified email, and a rollback request that must follow within 30
minutes from the same account. The constant `"website assistant"` approver is gone.

## Why

Rollback publishes a prior version to the live container. It must carry the same named,
verified human approval as publishing for Trimtale's L4 "writes go to staging, then to a
named, verified approver" rule to hold.

## Behavior

- Core: `approveTrackingRollback`, `rollbackApprovalCurrent`, `rollbackApprovalExpiresAt`;
  `rollback.approval` is validated when present. Publication and rollback share the same
  approval-window helper (no behavior change; existing publish tests unchanged and green).
- Runner: `approveAndRollback` is replaced by `approveRollback` (target fingerprint, typed
  container ID, verified approver; nothing is rolled back) and `rollbackApproved`
  (refuses `approval_required`, `rollback_fingerprint_mismatch`, `approval_expired`,
  `approver_changed` before any Google call). Publish shares the confirmation and
  approval-refusal helpers.
- Routes: `POST /api/google/workflows/:id/rollback-approval` and `POST .../rollback`
  require the publication switch and read the approver from the OAuth session; a client
  `approvedBy` is ignored. Previously the rollback route required a client-sent approver
  and did not check the publication switch at the route.
- Assistant: **Review rollback** opens a confirmation (container, restores, replaces,
  typed ID); approving shows "Approved restoring <target> by <email>" and a separate
  **Roll back to <target>** action. Refusals return to rollback review and never say
  "Nothing was published".
- Unchanged: publish behavior and copy, Google rollback guards, publication off by default.
- Out of scope: requiring `rollback.approval` on legacy `rolled_back` records in the
  schema (old records stay readable; every new rollback records one).

## Regression coverage

See the issue's regression contract. Unit tests cover each refusal (mismatch, missing or
unverified approver, stale approval, changed account, publication switch off) and the
happy path. The e2e rollback test was rewritten for the two-step flow and a stale-approval
e2e was added. The old e2e asserted `approvedBy: "website assistant"`; it now asserts no
approver is sent. The rollback e2e now answers the verification click's navigation with
204 so the page stays put for the extra steps (the old test only passed by clicking
before navigation finished; see the review).

## Verification

Local `npm run verify` (Chrome for Testing 153 in place of Playwright's pinned 151,
which this container cannot download): preflight, change docs, `npm run check` and
`npm test` (45 files, 440 tests) passed; Playwright 78 passed, 5 failed. All 5 are
visual baselines on screens this change does not touch (258–1247 px diffs) and fail
identically on unmodified `main` in the same container; GitHub CI on the pinned browser
is the gate for them. The rollback and publish e2e tests pass.

## Exploratory review

See `docs/reviews/2026-10-31-rollback-approval.md`.

## Documentation

`docs/security-and-publishing.md`, `docs/product-plan/current-capabilities.md`,
`.scratch/workflow-automation/spec.md`, and the new scratch issue 11.
