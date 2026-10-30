# Separate, confirmed publication approval with a verified approver

Change record version: 2

Issue: `.scratch/assistant-setup-operation/issues/06-publish-confirmation.md`

## Summary

Publishing from the assistant now takes three deliberate steps. First, a review shows exactly what will publish and requires typing the container ID. Second, a separate approval request records the signed-in Google account's verified email. Third, a separate publish request refuses a stale, mismatched or other-account approval.

## Why

The #55 publish path approved and published in one inline click and one request. The approver was the fixed string `website assistant`, and because approval and publication happened together, the 30-minute approval-freshness check could never fail.

## Behavior

- New `POST /api/google/workflows/:id/approve` takes `{ versionFingerprint, confirmation }`. It returns 409 for `fingerprint_mismatch`, `confirmation_mismatch` or `operation_not_versioned`. It records `approvedBy` from `GoogleOAuthSession.verifiedAccountEmail()` (Google userinfo for the session token; `email_verified` must be true) and stores the operation as `approved`. Nothing is published.
- `POST /api/google/workflows/:id/publish` now takes only `{ versionFingerprint }`. A body `approvedBy` is ignored. It returns 409 before any Google call for `approval_required`, `operation_not_approved`, `fingerprint_mismatch`, `approval_expired` (over 30 minutes) and `approver_changed`.
- Both routes return 403 before reading the account unless `GOOGLE_GTM_PUBLICATION_ENABLED=true`. `GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true` now also requests `openid email`. A backend authorized before this change must reconnect to approve.
- Core: an `approved`, unpublished operation may be re-approved, which renews the window. New helper `publicationApprovalExpiresAt()`.
- Extension: a versioned card offers **Review and approve**, never a direct publish. The review lists the container, workspace, version, the version it replaces and every planned change. **Approve `<fingerprint>`** stays disabled until the exact container ID is typed. **Publish `<fingerprint>`** appears only after approval. Blocked approval reasons lead back to review. A stored `approved` operation now renders on reopen instead of failing closed.
- Presenter copy no longer leads with workflow codes (`reached await_approval`, `Setup operation blocked:`). The approval stage is no longer shown as passed before an approval exists, or after it expired.
- Unchanged: publication stays disabled by default; Google-side guards (live-version drift, fingerprint-guarded publish); rollback (still sends `approvedBy: "website assistant"`, which the route ignores and does not record).

## Regression coverage

New `apps/api/src/workflow-routes.test.ts` (8). Updated `workflow-runner.test.ts` (approve/publish split, stale, mismatch, account change, Google failure), `google.test.ts` (scope, verified identity, refusals), `publication.test.ts` (renewal), `setup-operation-presenter.test.ts`, `workflow-bridge.test.ts` (`approved` now maps to publish), and `navigation-extension.spec.ts`. In the E2E suite, the four publish journeys now go through `approveThenPublish()`, plus a new typed-confirmation journey and a stale-approval journey. The removed `approveAndPublish` runner method was the single-request path this change exists to remove.

## Verification

- `npm run check`: pass.
- `npx vitest run`: 43 files, 363 tests pass (on #60 + #61).
- `npm run build`: pass.
- Playwright E2E (darwin): 72/72. Linux: CI once retargeted to `main`.

No test contacts Google: identity, Tag Manager and routes are faked.

## Exploratory review

`docs/reviews/2026-10-30-publish-confirmation.md`: versioned card, review (empty, case-mismatched, ready), approved card, stale-approval refusal, and a hostile change name. No blocker or high findings.

## Documentation

Updated `docs/engineering/approved-publication-rollback.md`, `gtm-workflow-runbook.md`, `local-development.md`, `docs/product-plan/current-capabilities.md` and `.scratch/assistant-setup-operation/spec.md`. Added issue 06.
