# Rollback approval with a verified approver

Change record version: 2

Issue: `.scratch/workflow-automation/issues/11-rollback-approval-and-verified-approver.md` (GitHub #71); also resolves `.scratch/workflow-automation/issues/12-post-publication-verification-survives-navigation.md` (GitHub #76)

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
- Google client: `rollbackPublishedVersion` refuses without a current rollback approval,
  mirroring `publishApprovedVersion`.
- Navigation survival (#76, high, found in review): a post-publication navigation run is
  saved to the service worker on the click (`chrome.storage.session`, per tab, 60 s). The
  next page in the tab waits out the click's settle time, records the evidence if the old
  page could not, then reloads the stored operation so **Review rollback** is reachable.
  Only collection requests sent by the clicked document count, from 100 ms before the
  click stamp on. The service worker takes the document from `sender.documentId` and
  records `details.documentId` on every request. The destination page's own page_view
  can therefore neither turn a working tag into `duplicate_fire` nor pass a broken one.
  A run resumes only on a page from the clicked link's origin, and it is removed when its
  tab closes. The stored request is rebuilt in scan key order, because `chrome.storage`
  reorders keys and the specification fingerprint hashes them in order. Evidence is
  posted only when the request maps to the operation's own specification.
- A stored rollback approval older than 30 minutes reloads as `rollback_required` (review
  again), not as approved.
- Copy: a blocked message states "Nothing was published/rolled back" once, not twice.
  A rollback `confirmation_mismatch` reads "The typed container ID did not match. Review
  the rollback and type it again." The `/rollback` route has its own error messages.
- Unchanged: publish behavior, Google rollback guards, publication off by default.
- Out of scope: the approve/execute race on both flows (#77), the open shadow root and
  untrusted approve events (#78), key-order-independent IDs in core (#79); requiring `rollback.approval` on legacy `rolled_back` records in the
  schema (old records stay readable; every new rollback records one).

## Regression coverage

See the issue's regression contract. Unit tests cover each refusal (mismatch, missing or
unverified approver, stale approval, changed account, publication switch off) and the
happy path. The e2e rollback test was rewritten for the two-step flow and a stale-approval
e2e was added. The old e2e asserted `approvedBy: "website assistant"`; it now asserts no
approver is sent. The rollback tests now go through the real navigation to `/services`.
A new e2e, "finishes post-publication verification on the next page when the link unloads
first", fails without the #76 fix and passes with it. Two more cover a destination page
that sends its own page_view: one passes a working tag, the other fails a broken tag.
Before the document filter they gave `duplicate_fire` and a false `browser_verified`.
`apps/extension/src/navigation-run.test.ts`, the new Google-client rollback refusals, and
the stored-expiry and route-message tests are added. The publish blocked-message test now
asserts the outcome is stated exactly once; before, it required the trailing "Nothing was
published.", which duplicated the guidance.

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
