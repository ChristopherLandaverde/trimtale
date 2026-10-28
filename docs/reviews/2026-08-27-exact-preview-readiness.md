# Exact Preview readiness review

Date: 2026-08-27

## Environment

- Built production extension in Chromium.
- Deterministic local API, lead-form fixture, and phone-link verification target.
- Recognized and loaded `GTM-TEST123` with durable Preview `preview-8`.

## Scenarios

1. Reached an exact form Preview binding with the expected target and container.
2. Changed the current history target before recording the Tag Assistant confirmation,
   then returned to the bound target and rechecked.
3. Completed exact form and phone-click runs after confirmation, including restart,
   repair, publication, client-routed, and attacker-labeled variants.

## Observations

- The receipt kept `Start exact browser run` absent while Tag Assistant confirmation
  was outstanding.
- It separated the provider-validated workspace and Preview fingerprints from the
  locally loaded container and current target.
- Target drift replaced the confirmation action with an exact mismatch explanation
  and a read-only recheck. It sent no draft-verification or second resume request.
- Returning to the bound page restored confirmation eligibility but did not reuse a
  stale Connected claim.
- The shared known-interaction path applied the same gate to phone-click evidence.
- Optional URL debug state and browser cookies were not treated as connection proof.

## Findings

- No blocker, high-, medium-, or low-severity finding.

## Evidence

- Target-drift capture: test output `exact-preview-target-drift.png`.
- Both affected suites: 24 Chromium journeys passed.
- `npm run verify`: 421 deterministic tests and 75 Chromium journeys passed.

## Supported boundary

Google documents the Tag Assistant Connected state and an optional debug signal in
the target URL, but not a supported page API that can attest to that state. The product
therefore combines its own observable container/target checks with explicit human
confirmation and keeps the claim non-durable.

- https://support.google.com/tagmanager/answer/6107056?hl=en
- https://support.google.com/tagmanager/answer/10039345?hl=en
