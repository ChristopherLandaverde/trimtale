# Define a generic browser-evidence contract

Delivery mode: implementation
Status: resolved

## Decision

Each tracking setup may carry one versioned browser evidence contract. The contract
is data consumed by a deterministic evaluator; it is neither collected run evidence
nor a verdict. One contract declares:

- The interaction and whether a positive business outcome must be observed.
- Allowed positive outcome evidence types.
- The verdict to use when an observable required outcome is absent.
- One expected destination and event matcher.
- Required parameter names on the matching request.
- Automatic event names that may coexist with the expected event.
- The minimum and maximum number of matching expected-event requests.
- Optional expected data-layer event and tag-action identifiers.
- Negative expectations such as absence of matching page errors.

Permitted automatic events are ignored only when counting duplicates. They cannot
satisfy the expected event, supply its parameters, or turn missing expected evidence
into a pass. Unrelated events that are not explicitly permitted remain visible as
diagnostic evidence but do not count as expected-event duplicates.

## Evaluation order

The shared evaluator will preserve the current verdict distinctions in this order:

1. Missing interaction or unobservable required outcome is inconclusive.
2. Expected non-conversion and failed interaction outcomes are classified before
   destination requests.
3. Denied required consent is inconclusive.
4. Matching expected-event requests are counted independently of permitted automatic
   events; excess matches are duplicates.
5. One in-policy match passes only when every required parameter is present.
6. Without a matching request, required outcome, data-layer, and tag observations
   distinguish missing event, tag-not-firing, request-missing, and inconclusive states.
7. A matching negative expectation fails before a passing verdict is returned.

Verdict codes and browser/platform confirmation boundaries remain unchanged. Human
next-action copy uses contract data such as the expected event name; it is not
hard-coded to `generate_lead`.

## Migration boundary

- Form, navigation, download, and phone-click contracts must pass the same evaluator.
- The existing form evaluator and fixture corpus remain authoritative until parity is
  proven case by case.
- Collection and privacy filtering remain interaction-specific where the browser APIs
  differ; only normalized evidence evaluation becomes generic.
- The contract is versioned independently from raw provider URLs and GTM internals.

## Non-goals

- Claiming GA4 reporting, attribution, or platform processing.
- Weakening event-specific privacy exclusions.
- Replacing existing form and navigation regressions before parity is proven.
- Generalizing provider callback evidence from one adapter.
- Treating every unrelated request as a duplicate.

## Regression contract

- `tests/acceptance/generic-browser-evidence-contract.json` defines lead-form,
  navigation, download, and phone-click contracts plus positive, negative, duplicate,
  consent-limited, missing-parameter, and absent-outcome cases.
- `packages/core/src/browser-evidence-acceptance.test.ts` schema-validates that fixture,
  and `packages/core/src/browser-evidence.test.ts` consumes every case through the
  production evaluator.
- Existing `packages/core/src/form-verdict.test.ts` expectations cannot change during
  migration without an explicit product decision.

## Authorization

The user explicitly authorized production implementation on 2026-08-27. The authorized
boundary is the versioned setup contract, shared deterministic evaluator, and migration
of form, navigation, download, and phone-click verdict paths. It excludes new GA4
reporting claims or broader browser evidence collection.

## Comments

- 2026-08-26: Issue 21 proved the immediate `generate_lead` boundary. This issue owns
  the separately reviewable generalization decision.
- 2026-08-27: Resolved the shared contract vocabulary, evaluation precedence,
  migration boundary, and executable acceptance fixture. ADR 0004 records why verdicts
  become contract-driven while browser collection remains interaction-specific.
- 2026-08-27: Implemented the versioned setup-owned contract and shared evaluator,
  migrated the four authorized interaction paths, and preserved interaction-specific
  evidence collection and platform-confirmation boundaries.
