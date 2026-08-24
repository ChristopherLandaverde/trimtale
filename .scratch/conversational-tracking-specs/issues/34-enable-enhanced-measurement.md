# Enable enhanced measurement safely

Delivery mode: implementation
Status: resolved

## Production outcome

When one recognized GA4 stream has enhanced measurement off, the practitioner can
review and explicitly enable its master switch from the existing workflow.

## Non-goals

- Do not change individual enhanced-measurement features.
- Do not mutate or publish GTM.
- Do not execute the change against ConsentFlow in this issue.
- Do not add key events or custom definitions.

## Authorization

On 2026-08-23 the user approved implementing the guarded write path and review UI,
with live execution requiring separate approval.

## Regression contract

- `apps/api/src/analytics.test.ts` proves writes fail closed, fresh-read the exact
  stream, update only `stream_enabled`, and avoid a redundant PATCH.
- `apps/api/src/google.test.ts` proves `analytics.edit` is separately gated and absent
  from ordinary read-only consent.
- `tests/e2e/gtm-connection-context.spec.ts` proves review shows the exact destination
  and boundaries, cancellation sends no write, and confirmation sends one exact
  request with a bounded result.

## Done when

- The master switch can change only after a fresh exact-stream read and visible
  confirmation.
- `npm run verify` and exploratory Chromium review pass.

## Comments

- 2026-08-23: Claimed after explicit implementation authorization.
- 2026-08-23: Implemented the separately gated review and exact master-switch update.
  Full verification passed 287 deterministic tests and 50 Chromium journeys. The
  exploratory review has no unresolved finding. No live Google write occurred.
- 2026-08-23: After separate approval and Analytics edit consent, enabled only the
  master switch for ConsentFlow property `550074997`, stream `15443100029`. Independent
  read-back showed the switch and all seven features on. The edit session was closed.
