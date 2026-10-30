# Separate, confirmed publication approval with a verified approver

Status: resolved

## Objective

Close three gaps in the approval-gated publish path from #55:

1. Approval was a single inline click with no confirmation of what would publish.
2. The approver was the fixed string `website assistant`.
3. Approval and publication happened in one request, so the 30-minute approval
   freshness check could never fail.

Approved by Christopher on 2026-10-30. Publishing stays disabled by default behind
`GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED` and `GOOGLE_GTM_PUBLICATION_ENABLED`.

## Regression contract

- `packages/core/src/publication.test.ts`: an unpublished approval can be renewed; a
  published version cannot be re-approved; a blank approver is refused; expiry is 30 min.
- `apps/api/src/google.test.ts`: `openid email` is requested only with publish consent;
  the approver comes from Google userinfo for the session token; an unverified, missing
  or malformed email and a disconnected session are refused.
- `apps/api/src/workflow-runner.test.ts`: approve and publish are separate and the
  approver is recorded; fingerprint or confirmation mismatch blocks approval; publish
  without approval, with a mismatched fingerprint, or as another account is blocked;
  a stale approval is blocked before any Google call and a renewed approval publishes;
  a Google failure leaves the operation `approved` and unpublished.
- `apps/api/src/workflow-routes.test.ts`: a client-supplied approver is ignored; a
  mismatched fingerprint returns 409; a stale approval returns 409 with no Google call;
  a missing approval, a wrong confirmation and an account change are refused; disabled
  publication returns 403 before identity is read; an unverifiable identity returns 403.
- `apps/extension/src/setup-operation-presenter.test.ts`: a versioned card offers
  review, never a direct publish; publish is offered only after approval and names the
  approver; blocked approval reasons route back to review; the review lists exactly
  what will publish.
- `tests/e2e/navigation-extension.spec.ts`: the review shows container, workspace,
  fingerprint, replaced version and changes; approval stays disabled until the exact
  container ID is typed; approval and publish are separate requests and neither sends an
  approver; a stale approval sends the practitioner back to review.

## Comments

- 2026-10-30: Resolved by `feat/publish-confirmation`, stacked on
  `feat/assistant-focosys-ux`. Rollback still sends `approvedBy: "website assistant"`,
  and the rollback route ignores it and records no approver. That is left as a
  follow-up decision.
