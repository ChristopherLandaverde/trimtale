# Generic browser evidence runtime review

Date: 2026-08-27

## Environment

- Built production core, API, fixture site, verification target, and extension.
- Chromium with deterministic local provider routes.
- Form, navigation, and phone-link targets, including denied Analytics reads and
  attacker-controlled target labels.

## Scenarios

1. Completed exact lead-form browser verification with one matching `generate_lead`
   request and kept GA4 platform confirmation separate.
2. Repeated form verification when the Analytics read provider denied access.
3. Authored and exactly verified a privacy-safe phone-click setup.
4. Generated and reviewed navigation setup across recognized and missing measurement
   contexts.
5. Rendered page-controlled navigation labels as inert text.

## Observations

- Existing accepted form and phone-click runs still passed through the shared
  evaluator.
- Provider-read denial did not convert browser proof into a GA4 platform claim.
- Phone-number and link-value privacy exclusions remained visible and persisted
  evidence retained only the matching known-interaction request.
- Navigation setup carried the required link parameter contract without changing the
  setup review flow.
- Attacker-controlled labels did not alter executable markup.

## Findings

- No blocker, high-, medium-, or low-severity finding.

## Evidence

- Focused production and migration tests: 78 passed.
- Focused Chromium journeys: 12 passed.
- Full verification: 436 deterministic tests and 75 Chromium journeys passed.
