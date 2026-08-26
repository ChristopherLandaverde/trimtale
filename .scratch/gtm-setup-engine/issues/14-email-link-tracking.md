# Add email-link tracking

Delivery mode: implementation
Status: resolved

## Production outcome

From the website agent, a practitioner can request email-link tracking. The agent
counts observable `mailto:` links without exposing their values, asks for sitewide or
current-page scope, and produces a privacy-safe `email_click` setup through the shared
review, managed-workspace, and exact-preview workflow.

## Non-goals

- Treating an email-link click as a sent message, lead, or conversion outcome.
- Sending the email address, `mailto:` URL, subject/body query values, or visible link
  text to GA4.
- Tracking ordinary form email fields or arbitrary text containing an email address.
- Adding automatic-coverage behavior, CTA selection, SPA-route handling, or portal
  behavior.
- Adding an event-specific workflow outside the shared known-interaction recipe.

## Authorization

The user authorized continuing through all low-complexity projects on 2026-08-25.
This remains one independently reviewable vertical slice.

## Regression contract

- `packages/core/src/interaction-authoring.test.ts` proves the `email_click` recipe,
  privacy exclusions, scope, consent, verification expectations, and bounded local
  `mailto:` counting.
- `packages/core/src/conversation.test.ts` and
  `tests/acceptance/conversation-intake.json` prove email intent requires observable
  page evidence and scope.
- `packages/core/src/agent-turn.test.ts` proves grounded visible scope and the
  no-evidence blocker without leaking an email address.
- `tests/e2e/email-link-interactions.spec.ts` proves visible scope, privacy review,
  generated setup, no-evidence behavior, and attacker-shaped `mailto:` values that
  never enter the assistant state or artifact.

## Dependencies

- Issue 10 shared known-interaction authoring.
- Issue 12 low-effort link interactions.

## Comments

- 2026-08-25: Added the shared `email_click` recipe, two acceptance cases, bounded
  `mailto:` evidence, privacy exclusions, and two built-extension journeys. Exploratory
  review found no unresolved blocker or high-severity issue and recorded long-review
  scroll context as separate UI work. `npm run verify` passed 404 deterministic tests
  and 60 Chromium journeys; all builds, typechecks, preflight checks, and 67 change
  records passed.
