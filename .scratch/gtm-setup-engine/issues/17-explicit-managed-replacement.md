# Explicit managed-entity replacement approval

Delivery mode: specification
Status: proposed

## Proposed production outcome

When a fresh GTM plan finds a same-name, product-owned entity whose semantics differ,
the website agent displays the exact current and proposed behavior. A practitioner can
approve replacement of that exact entity and plan fingerprint, after which the
ordinary apply, validation, exact-preview, version, and publication gates continue.

The backend fresh-reads the managed entity and requires its ownership marker, entity
ID, fingerprint, and plan fingerprint to match the review before making any write.

## Non-goals

- Replacing human-owned or unmarked GTM entities.
- Deleting entities or resolving general name collisions.
- Changing the confirmed tracking intent during replacement review.
- Bypassing application, validation, exact browser preview, or publication approval.
- Approving more than the exact reviewed entity and plan fingerprint.
- Building a general GTM diff editor.

## Scope decision required

Issue 30 intentionally made replacement approval a non-goal. The authorized real
Stage 1 run now requires that behavior, so implementation needs explicit approval as
a separate product slice.

The smallest implementation adds one exact replacement-approval transition to the
durable operation workflow. It does not grant a general mutation permission and does
not publish.

## Proposed regression contract

- `packages/core/src/tracking-operation.test.ts` proves replacement approval binds the
  operation, plan fingerprint, entity kind, entity ID, and current fingerprint.
- `apps/api/src/workflow-runner.test.ts` proves no provider write occurs before exact
  approval and stale or mismatched approval fails closed.
- `apps/api/src/google-application.test.ts` proves only the reviewed product-owned
  entity may be updated after a fresh provider read.
- `tests/e2e/conversational-form.spec.ts` displays the current and proposed semantics,
  requires an explicit replacement action, and then resumes the ordinary exact-preview
  workflow without publication.

## Dependencies

- Issue 03 durable generic operations.
- Issue 11 credentialed Stage 1 workflow.

## Live evidence

On 2026-08-26, the authorized launcher passed its exact URL, extension, API-session,
container, official-loader, and GA4-destination gates. Fresh operation
`operation_spec_form_workflow-smoke-form` remained `planned` with plan fingerprint
`plan_1bad87937666`:

- trigger `9` was reusable;
- managed tag `7` returned `managed_change_requires_approval`; and
- `Page URL` required no change.

The credentialed session was closed with no workspace, entity, version, publication,
rollback, or GA4 mutation.
