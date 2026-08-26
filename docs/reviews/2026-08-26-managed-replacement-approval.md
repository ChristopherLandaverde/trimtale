# Managed replacement approval review

Date: 2026-08-26

## Environment

- Built production extension in headed managed Chromium.
- Local deterministic API, fixture site, and verification target.
- Controlled product-owned tag conflict and approval response.
- No real Google workspace mutation.

## Scenarios

1. Planned a same-name semantic change for product-owned tag `7` and confirmed that
   application was unavailable before replacement review.
2. Reviewed the exact plan fingerprint, entity ID, current Google fingerprint, and
   normalized current/proposed semantics.
3. Approved that exact replacement and confirmed that the ordinary apply review—not
   application or publication—became available.
4. Included markup-bearing attacker text in the current semantics and exercised stale
   plan, entity ID, and current-fingerprint rejection in permanent regressions.

## Observations

- The exact current and proposed payloads are readable in separate bounded panels.
- The approval request contains only the reviewed plan and entity bindings.
- Markup-bearing semantics render as inert text and create no image element.
- The pre-approval state performs no provider call. The approved state still requires
  the existing apply confirmation and later preview/version/publication gates.

## Findings

- Fixed during review: the semantic receipt originally followed its action controls
  and could fall below the composer. It now precedes the decision controls.
- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- Focused deterministic tests: 36 core approval/planning tests, 12 workflow-runner
  tests, and 6 Google application tests passed.
- Focused headed Chromium review passed.
- Capture: `managed-replacement-review.png` under the focused Playwright result
  directory.
- `npm run verify`: 417 deterministic tests across 51 files and 70 Chromium journeys
  passed.
