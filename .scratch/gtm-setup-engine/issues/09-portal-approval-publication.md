# Version-bound approval, publication, and rollback

Delivery mode: implementation
Status: in progress

## Production outcome

The website agent presents one verified GTM version and any separately reviewed GA4
changes in chat, records human publication approval, publishes only the approved GTM
fingerprint, and retains prior-live rollback evidence. The portal exposes the same
durable operation history and resulting state without being a required step.

## Non-goals

- Requiring a portal visit to complete publication.
- Tag authoring in the portal.
- General publication authority for the model.
- Approval that survives a version or live-container change.

## Authorization

The user selected publication from chat after human approval on 2026-08-24 and later
authorized continuous Stage 1 implementation. The current website-chat slice records
an explicit human action but does not claim a portal-authenticated personal identity.

## Regression contract

- Stale fingerprint, changed live container, changed approver authority, and revoked
  Google access fail closed.
- Publication never follows model output or workspace verification without an exact
  human approval receipt.
- A signed-in user can review, approve, and publish from chat without navigating to
  the portal.
- Rollback targets only the recorded prior-live version and produces a new receipt.
- The website agent and portal display consistent operation state after interruption.

## Dependencies

- Issues 06, 07, and 08.

## Implemented checkpoint

- After exact browser preview, chat presents the immutable version fingerprint and a
  separate publication review; no publication call occurs during setup approval,
  application, validation, browser verification, or version creation.
- The confirmation action sends only the operation identity and displayed version
  fingerprint through the protected extension boundary. The backend records a
  short-lived approval for that fingerprint, rechecks the immutable version and prior
  live version, and publishes only when Google confirms the same fingerprint.
- Failed approval, stale state, disabled publication, malformed responses, and
  provider failure never produce a publication-success claim.
- Controlled Chromium covers the complete chat sequence through Google-confirmed
  publication. Unit tests cover wrong fingerprints, separate approval, durable state,
  replay, approval expiry, live drift, and provider rejection.
- The website agent now continues from publication into a live browser run. Passing
  evidence completes the operation; failed evidence alone unlocks a separate review
  of the recorded prior-live fingerprint and an explicit guarded rollback action.
  Inconclusive evidence keeps rollback locked and remains retryable.

## Remaining work

- Replace the actor-class receipt (`website_chat_human`) with the signed-in portal
  user's durable organization membership and authority. Extension-origin protection
  is not user authentication.
- Expose the same operation, approval, and publication receipts in portal history.
- Exercise approval and publication against a real authenticated Google account with
  the separately requested publication scope and enablement flag.
