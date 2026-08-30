# Post-Publication Browser Verification

Status: proposed

## Objective

Define and implement the workflow that starts after an approved GTM version has been
published. The assistant should verify, from browser-observable evidence, that the
real site interaction sends the expected Google collection request. It must not claim
Google Analytics platform processing, reporting, attribution, or downstream receipt.

## Product boundary

This workflow proves:

- The exact approved GTM version was published.
- The practitioner ran the expected site interaction after publication.
- The browser observed exactly the expected Google collection request for the
  confirmed specification.
- The request carried the required event name and parameters that are observable from
  the network request.

This workflow does not prove:

- GA4 processed the hit.
- GA4 reported the hit.
- Google Ads, Meta, CRM, or any destination accepted the event.
- Attribution, audience, conversion, or reporting eligibility.

Use product language such as **Google request verified** or
**Browser-to-Google verified**. Do not use `platform-confirmed`, `GA4 confirmed`,
`reported in GA4`, or equivalent claims.

## User outcome

A practitioner publishes an approved GTM version, selects **Start browser verification**,
performs the confirmed page interaction, and receives a durable result:

```text
Published approved version
  -> Browser verification run started
  -> Confirmed interaction observed
  -> Google collection request verified
  -> Platform confirmation unavailable
```

If verification fails, the operation moves to a rollback-ready state with the prior
live version fingerprint visible for explicit rollback approval.

## Testing plan

### Domain contracts

- Add/extend core tests for post-publication evidence recording:
  - `browser_verified` evidence moves a published operation to `completed`.
  - failed browser evidence moves a published operation to `rollback_required`.
  - inconclusive browser evidence does not become platform confirmation.
  - evidence with the wrong specification ID is rejected.
- Add event/request-specific assertions for navigation-click and lead-form evidence:
  - expected event name is present.
  - required observable parameters are present.
  - exactly one matching Google collection request is observed.
  - duplicate requests fail.
  - missing request fails.
  - consent-denied or unobservable states remain inconclusive when applicable.

### API contracts

- Add a route that records post-publication browser evidence for an operation.
- The route accepts only a published operation.
- The route rejects evidence for a different specification.
- The route persists the updated operation state and returns either `completed` or
  `rollback_required`.
- The route must not call Google publication, rollback, or platform APIs.
- Response bodies must not include raw cookies, form values, arbitrary page text,
  OAuth tokens, or unsanitized Google/browser errors.

### Extension contracts

- The assistant renders **Start browser verification** only after operation status is
  `published`.
- Verification starts from the visible assistant, not from a hidden direct API call.
- The extension captures only privacy-filtered browser evidence:
  - confirmed target identity;
  - interaction outcome;
  - matching data-layer/event evidence when available;
  - matching Google collection request URL and timestamp after privacy normalization;
  - consent state when observable.
- The assistant displays:
  - `Google request verified` when browser evidence passes;
  - `Browser verification failed` when evidence fails;
  - `Platform confirmation unavailable` in both cases.
- The assistant never renders `platform-confirmed`.

### E2E scenarios

- Happy path: published navigation operation, start verification, click confirmed
  navigation target, one expected Google request, operation becomes `completed`.
- Happy path: published lead-form operation, submit confirmed form successfully, one
  expected `generate_lead` Google request, operation becomes `completed`.
- Negative: published operation, confirmed interaction occurs but no Google request,
  operation becomes `rollback_required`.
- Negative: duplicate Google requests, operation becomes `rollback_required`.
- Inconclusive: consent-limited or insufficient observable evidence remains bounded
  and does not trigger rollback automatically unless the product decision says it
  should.
- Adversarial: page-controlled labels, URLs, and form values do not enter persisted
  evidence or assistant claims.
- Reload: a completed or rollback-required operation reloads from durable state and
  does not rerun verification automatically.

## Acceptance criteria

- [ ] A published navigation operation can start browser verification and record
      `Google request verified` from deterministic E2E evidence.
- [ ] A published lead-form operation can start browser verification and record
      `Google request verified` from deterministic E2E evidence.
- [ ] Failed post-publication browser evidence moves the operation to
      `rollback_required` with the prior live fingerprint visible.
- [ ] Duplicate, missing, and wrong-event Google requests are permanent regressions.
- [ ] Platform confirmation is labelled unavailable, not pending or confirmed.
- [ ] Privacy sentinels prove form values, cookies, credentials, arbitrary labels,
      hostile URLs, and raw browser errors do not enter persisted evidence.
- [ ] Completed and rollback-required operation states reload from durable API state.
- [ ] Exploratory Chromium review covers one passing path, one rollback-required path,
      and one adversarial page state.
- [ ] `npm run verify` passes.

## Open decisions

- Should inconclusive post-publication evidence become `rollback_required`, stay
  `published` with verification blocked, or use a new operation status?
- Should the assistant immediately guide rollback after failed browser verification,
  or should rollback be a separate explicit workflow slice?
- Should navigation and form post-publication verification share one API request shape,
  or should they use separate versioned evidence envelopes?
- What exact UI label should replace older `Platform confirmation: unverified` copy:
  `Platform confirmation unavailable`, `Platform receipt unavailable`, or
  `Platform processing not verified`?

## Out of scope

- GA4 DebugView or reporting API receipt.
- Google Ads conversion confirmation.
- Meta CAPI or other destination receipt.
- Autonomous rollback.
- Scheduled monitoring.
- Real Google live-write E2E in ordinary verification.
