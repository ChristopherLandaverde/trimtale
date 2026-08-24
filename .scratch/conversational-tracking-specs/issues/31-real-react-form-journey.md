# Prove the lead-form path on React

Delivery mode: implementation

Status: resolved

## Production outcome

The unchanged built extension can discover, confirm, generate, and browser-verify one
form rendered and submitted by a real React runtime.

## Non-goals

- Adding React-specific logic to the extension or shared domain.
- Covering Next.js, server components, hydration, or every React form library.
- Calling Google, preparing a workspace, or publishing GTM changes.
- Expanding the React example into a generalized framework test system.

## Authorization

The product owner requested React support as part of the MVP and told the agent to
continue further on 2026-08-23.

## Regression contract

- `tests/e2e/react-form.spec.ts` proves the page runs React, renders the form after the
  shell loads, and completes the existing visible extension journey.
- The run observes one successful outcome, one `generate_lead` request with required
  metadata, a passing browser verdict, and no submitted value in the workbench.
- No production framework adapter is added.

## Comments

- 2026-08-23: Claimed after the audit confirmed existing SPA coverage uses plain
  JavaScript and does not prove React compatibility.
- 2026-08-23: Resolved after the real React page completed discovery, confirmation,
  synthetic submit, SPA transition, one metadata-only GA4 request, and a passing browser
  verdict. Empty required input remained non-converting. Full verification passed 278
  deterministic tests and 45 Chromium journeys.
