# Review a lead-form operation plan in the workbench

Delivery mode: implementation

Status: resolved

## Production outcome

A practitioner who approved a connected `generate_lead` setup can explicitly prepare
the managed workspace, create or reuse the durable operation, and review its safe
change-plan summary without leaving the workbench.

## Non-goals

- Applying plan actions.
- Creating a GTM version.
- Publication, post-publication verification, or rollback.
- Navigation, Enhanced Measurement expansion, or model behavior.

## Authorization

The product owner requested implementation of the workflow on 2026-08-23 after
confirming the MVP is fast GTM-to-GA4 event setup from one workspace.

## Regression contract

- `tests/e2e/conversational-form.spec.ts` proves the explicit action sends the confirmed
  form specification and connected container context through the extension boundary,
  renders only a bounded plan summary, and never calls resume or publication routes.
- The same browser suite proves an unavailable or invalid plan becomes an honest
  blocker without claiming that anything was applied.

## Comments

- 2026-08-23: Claimed before implementation.
- 2026-08-23: Added explicit preparation and bounded plan review for confirmed
  `generate_lead` setups. Full verification passed 307 deterministic tests and 39
  Chromium journeys; planning made no resume or publication request.
