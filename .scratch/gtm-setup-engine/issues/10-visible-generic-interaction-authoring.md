# Visible generic interaction authoring

Delivery mode: implementation
Status: resolved

## Production outcome

The website agent turns an observable, supported interaction into a scoped generic
tracking setup, explains parameter and privacy choices, obtains human approval, and
sends the same setup through the durable managed-workspace planner.

## Non-goals

- Treating a phone click as a completed call or qualified lead.
- Sending contact values, `tel:` URLs, or visible phone-link text to GA4.
- Requiring a model call for a known event recipe.
- Publishing or claiming browser evidence during authoring.

## Authorization

The user authorized continuous Stage 1 implementation on 2026-08-24.

## Regression contract

- `packages/core/src/interaction-authoring.test.ts` proves sitewide and page-only
  firing policies, consent requirements, parameter exclusions, and query-string
  removal.
- `packages/core/src/conversation.test.ts` and `packages/core/src/agent-turn.test.ts`
  prove reusable scope intake and privacy-safe review state.
- `apps/api/src/workflow-runner.test.ts` proves a generic setup enters the same durable
  planning boundary used by existing setups.
- `tests/e2e/conversation-intake.spec.ts` proves the visible Chromium journey from
  natural language through scope, review, approval, download, and managed-workspace
  change planning.

## Dependencies

- Issues 01 through 04.

## Resolution

- Known interaction behavior is registered as data and compiled by the generic setup
  compiler; the conversation and review path consume the shared definition.
- Phone-link discovery sends only a bounded count through intake. Raw phone numbers,
  link text, and `tel:` values are neither displayed in the review nor mapped into GA4
  event parameters.
- GA4's automatically collected page context is explained instead of duplicated as a
  custom parameter.
- Durable operations accept a confirmed generic setup as their specification while
  retaining the legacy navigation and form boundary during migration.
