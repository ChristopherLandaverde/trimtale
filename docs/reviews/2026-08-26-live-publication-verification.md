# Live publication verification review

Date: 2026-08-26

## Environment

- Built production extension in headed managed Chromium.
- Local deterministic API, fixture site, and verification target.
- Controlled GTM responses for version `version-8` and prior-live target `live-7`.
- No real Google workspace mutation or publication.

## Scenarios

1. Completed the visible lead-form workflow through exact draft evidence, immutable
   version review, publication approval, controlled publication, and a passing live
   browser run.
2. Repeated the workflow with a live `tag_fired_request_missing` result, reviewed the
   exact failed and prior-live fingerprints, and explicitly confirmed rollback.
3. Added attacker-shaped markup to the page and submitted a private form value during
   the failed run.

## Observations

- The passing state names the published fingerprint and marks the operation complete.
- No rollback copy or action appears after passing evidence.
- The failed state names the failed fingerprint and prior-live target but performs no
  rollback request before review and confirmation.
- Rollback review keeps both exact fingerprints visible and labels the action as
  separate from the failed browser result.
- The private form value and attacker-shaped page sentinel were absent from the live
  evidence and rollback request bodies and from visible agent state.
- The task remains readable at the tested overlay size; primary rollback actions are
  visible without obscuring the affected form.

## Findings

- No blocker, high-, medium-, or low-severity finding.

## Evidence

- `npm run verify`: 406 deterministic tests and 62 Chromium journeys passed.
- Headed focused review: both post-publication journeys passed.
- Captures: `live-publication-verified.png`, `live-publication-failed.png`, and
  `live-rollback-review.png` under the focused Playwright result directories.
