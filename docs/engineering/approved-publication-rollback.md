# Approved publication, verification, and rollback

Production publication is the only stage that requires both persisted practitioner
approval and separate backend enablement. `GOOGLE_GTM_PUBLICATION_ENABLED=true` adds
Google's `tagmanager.publish` scope and is checked by `npm run preflight:publication`.
The ordinary Google preflight and CI never require this flag.

## Approval and publication

Approval is created only from a `versioned` operation, records the approver and time,
and copies the immutable version fingerprint. It expires after 30 minutes. Publication
then re-reads both the immutable version and currently live version. It proceeds only
when:

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
