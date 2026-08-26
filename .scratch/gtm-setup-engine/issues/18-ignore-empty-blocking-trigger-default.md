# Ignore Google's empty blocking-trigger default

Delivery mode: implementation
Status: resolved

## Production outcome

The change planner treats an omitted Google `blockingTriggerId` field as equivalent to
the generated empty list. A tag whose remaining normalized semantics match is reused
without replacement approval or a provider write.

## Non-goals

- Ignoring non-empty blocking triggers.
- Weakening ownership, entity-ID, fingerprint, or plan checks.
- Normalizing unrelated provider fields.
- Changing the generated setup or publication workflow.

## Authorization

The authorized Stage 1 workflow exposed this false conflict during exact managed
replacement review. Correcting it is required to continue the already-authorized
workflow without an unnecessary Google mutation.

## Regression contract

- `packages/core/src/change-plan.test.ts` proves omitted and empty blocking-trigger
  lists are equivalent while the rest of the tag remains unchanged.
- Existing managed-change tests continue to prove real semantic differences require
  exact replacement approval.

## Live evidence

On 2026-08-26, fresh plan `plan_7478734231d2` compared product-owned tag `7` at Google
fingerprint `1787537136131`. Exact current/proposed review showed identical normalized
behavior except that current state omitted `blockingTriggerId` and the generated state
contained `blockingTriggerId: []`. No Google write was approved or attempted.

## Resolution evidence

- The regression failed with a managed conflict before normalization and passes with a
  ready reuse action afterward.
- Existing real managed semantic-difference regressions still require exact approval.
- `npm run verify` passed 418 deterministic tests across 51 files and 70 Chromium
  journeys.
