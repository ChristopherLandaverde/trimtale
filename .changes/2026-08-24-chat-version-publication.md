# Publish the exact reviewed GTM version from chat

Change record version: 2

Issue: `.scratch/gtm-setup-engine/issues/09-portal-approval-publication.md`

## Summary

Add a separate immutable-version publication review to the website agent and connect
its explicit confirmation through protected approval and publish endpoints to the
existing fingerprint- and live-state-guarded Google client.

## Why

The Stage 1 edge-efficiency goal requires completing setup from chat. Requiring a GTM
or portal detour after exact preview would leave the final high-risk step outside the
same reviewable operation, while treating earlier setup approval as publication
authority would be unsafe.

## Behavior

Publication controls appear only when the backend reports separately enabled publish
capability. Chat displays the exact immutable fingerprint, planned changes, live
effect, and post-publish obligation before offering one explicit “Approve & publish”
action. The backend records a short-lived approval for that fingerprint, then the
Google client re-reads the immutable version and prior live state and publishes only
the same fingerprint. Every failure path avoids a success claim.

The current approval actor is the non-personal class `website_chat_human`. This does
not claim portal authentication, organization membership, or enterprise audit
identity. Live post-publication verification, rollback invocation, portal history,
and real-Google publication remain follow-up work.

## Regression coverage

Runner tests prove wrong-fingerprint rejection, separate approval, durable published
state, and idempotent replay. Google-client tests now also prove that exact-policy
version creation accepts only `draft_verified` operations whose fresh quick-preview
fingerprint still matches the browser-bound preview. Chromium proves the visible path
from exact preview through version review and provider-confirmed publication, with no
publication requests before the final confirmation and only the fingerprint crossing
the extension boundary.

## Verification

`npm run verify` passes preflight, 61 change-document checks, every workspace
typecheck, 377 unit tests, and 52 Playwright Chromium journeys. The complete
chat-publication journey passes within that full suite.

## Exploratory review

Controlled Chromium review confirmed the dedicated publication binding, exact
fingerprint copy, zero early publication calls, explicit approval button, sanitized
extension response, provider confirmation receipt, and post-publication verification
prompt. No real Google version was published in this environment.

## Documentation

Issue 09 and the Stage 1 progress record now distinguish working chat publication
from the remaining identity, portal history, live verification, rollback, and
real-provider work.
