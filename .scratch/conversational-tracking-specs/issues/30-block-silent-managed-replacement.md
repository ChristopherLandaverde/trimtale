# Block silent managed-entity replacement

Delivery mode: implementation

Status: resolved

## Production outcome

A plan may create or reuse managed GTM entities, but it must block when a same-name
managed entity differs semantically. The workbench explains that explicit replacement
approval is required and offers no apply action.

## Non-goals

- Adding an edit, migration, or replacement-approval workflow.
- Publishing or deleting GTM entities.
- Changing identical reuse, no-op, or new-entity creation.
- Generalizing the finding into a broad diff framework.

## Authorization

The product owner said to continue on 2026-08-23 after the live ConsentFlow review
found that version 4 would replace a data-layer success trigger with a visible-element
trigger.

## Regression contract

- `packages/core/src/change-plan.test.ts` proves a same-name managed semantic change
  becomes `managed_change_requires_approval`, while identical entities still reuse.
- `apps/api/src/google-application.test.ts` proves the blocked plan performs no entity
  writes.
- `tests/e2e/conversational-form.spec.ts` proves the workbench names the conflict and
  exposes no application action or resume request.

## Comments

- 2026-08-23: Claimed from the credentialed ConsentFlow version-4 finding.
- 2026-08-23: The planner now returns `managed_change_requires_approval`; application
  makes no provider call, and the workbench exposes no apply action. Full verification
  passed 278 deterministic tests and 44 Chromium journeys. Exploratory review found
  and fixed clipped decision context; no finding remains.
