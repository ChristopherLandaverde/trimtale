# Show every grounded tracking target

Delivery mode: implementation
Status: resolved

## Production outcome

When conversation intake grounds a tracking request in a form or known link
interaction, the website agent marks the matching page element before review. A form
selected automatically is shown as confirmed. Matching phone, email, outbound, and
download links are shown as candidates while scope is open and confirmed after the
scope decision.

## Non-goals

- Sending selectors, destinations, contact values, or visible link text through the
  extension message boundary or into agent state.
- Scrolling the page automatically or tracking elements that are not currently
  observable.
- Adding CTA/button selection, changing setup semantics, or changing approval
  authority.
- Fixing long-card scrolling, task correction controls, copy, or task restoration.

## Authorization

The user requested work on the identified UX gaps on 2026-08-25 after directly finding
that the controlled single-form demo lacked a visible target confirmation.

## Regression contract

- `tests/e2e/conversation-intake.spec.ts` proves an automatically resolved single form
  receives one confirmed page highlight before setup review.
- `tests/e2e/known-link-interactions.spec.ts` proves phone, email, outbound, and download
  requests highlight only their locally matched page elements without exposing page
  values in the agent task.
- Existing multi-form candidate and confirmed visual contracts remain unchanged.

## Dependencies

- Conversational-spec issue 11 target highlighting.
- GTM setup-engine issues 12 and 14 known link interactions.

## Comments

- 2026-08-25: Added confirmed highlighting for automatically resolved forms and
  local-only candidate/confirmed markers for phone, email, outbound, and download
  links. The exploratory review found no blocker or high-severity issue and recorded
  compact receipt wrapping as issue 38. The full gate passed 404 deterministic tests
  and 61 Chromium journeys; all builds, typechecks, preflight checks, and 68 change
  records passed.
