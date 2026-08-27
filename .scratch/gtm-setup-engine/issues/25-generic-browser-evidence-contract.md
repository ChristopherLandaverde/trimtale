# Define a generic browser-evidence contract

Delivery mode: specification
Status: open

## Question

How should one tracking specification declare the browser evidence required for its
event without adding event-specific verifier branches?

## Proposed outcome

The tracking setup declares expected event and destination matchers, required
parameters, permitted automatic events, duplicate policy, positive outcome evidence,
and negative expectations. The verdict engine evaluates normalized run evidence
against that contract.

## Non-goals

- Claiming GA4 reporting, attribution, or platform processing.
- Weakening event-specific privacy exclusions.
- Replacing existing form and navigation regressions before parity is proven.
- Generalizing from one provider callback without representative cases.

## Acceptance outline

- Lead form, navigation, download, and one additional event use the same contract
  evaluator.
- Unrelated automatic events cannot pass or create false duplicates.
- Missing parameters, duplicate requests, consent limits, and absent outcomes remain
  distinct verdicts.
- Existing scenario-corpus expectations remain unchanged.

## Comments

- 2026-08-26: Issue 21 proved the immediate `generate_lead` boundary. This issue owns
  the separately reviewable generalization decision.
