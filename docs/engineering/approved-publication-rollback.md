# Approved publication, verification, and rollback

Production publication is the only stage that requires both persisted practitioner
approval and separate backend enablement. OAuth consent and execution are independent:
`GOOGLE_GTM_PUBLICATION_SCOPE_REQUESTED=true` includes Google's `tagmanager.publish`
scope, plus `openid email` so approvals can name the signed-in account, in the one-time consent, while `GOOGLE_GTM_PUBLICATION_ENABLED=true` alone makes
the fingerprint-guarded client method reachable. `npm run preflight:publication`
requires both exact flags. The ordinary CI gate requires neither.

## Approval and publication

Approval and publication are separate requests:

1. `POST /api/google/workflows/:id/approve` with `{ versionFingerprint, confirmation }`.
   The assistant first shows exactly what would publish (container, workspace, version
   fingerprint, the live version it replaces, and the change list) and enables approval
   only when the practitioner types the container ID. The backend checks the fingerprint
   (409 `fingerprint_mismatch`) and the typed container ID (409 `confirmation_mismatch`)
   again. It records the approver as the email Google's userinfo endpoint returns for the
   backend's OAuth session (it must be verified), never a value from the request body. The
   operation becomes `approved`. An `approved`, unpublished operation may be approved
   again, which renews the 30-minute window.
2. `POST /api/google/workflows/:id/publish` with `{ versionFingerprint }`. It is refused
   with 409 before any Google call when there is no approval (`approval_required`), the
   fingerprint differs (`fingerprint_mismatch`), the approval is older than 30 minutes
   (`approval_expired`), or a different Google account is now signed in
   (`approver_changed`).

Both routes return 403 before reading the account when `GOOGLE_GTM_PUBLICATION_ENABLED`
is not `true`. Publication then re-reads both the immutable version and currently live
version. It proceeds only when:

- the approval is present, unexpired, and matches the immutable fingerprint;
- the immutable version still returns that fingerprint; and
- the live container still matches the recorded prior-live fingerprint.

The client calls Google's
[fingerprint-guarded version publish endpoint](https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.versions/publish)
with an empty body. The response must confirm the same version fingerprint without a
compiler error.

## Post-publication evidence

A normalized tracking run must belong to the operation's confirmed specification.
Only a `browser_verified` passing verdict completes the operation. Any non-passing
browser verdict records its run ID, moves the operation to `rollback_required`, and
sets the rollback target to the prior-live fingerprint. Browser evidence continues to
leave platform confirmation explicitly unverified.

## Rollback

Rollback re-reads the prior immutable version and requires its fingerprint to match
both the version record and rollback target. It also requires the live container still
to be the failed newly published fingerprint. Only then does it publish the prior
version with Google's fingerprint guard and return explicit completion evidence.

No publish or rollback method is reachable when the separate backend publication flag
is absent. Ordinary tests use deterministic fake fetch functions and assert exact
publication paths; they do not contact Google.
