# Representative exact-preview review

Date: 2026-08-26

## Environment

- Built production extension in headed managed Chromium.
- Local deterministic API, fixture site, and verification target.
- Controlled managed-workspace and exact-preview responses.
- No real Google workspace mutation.

## Scenarios

1. Completed exact preview and immutable version creation on a static form.
2. Repeated the same workflow after the target form was inserted dynamically.
3. Repeated it when success changed the URL through client-side routing.
4. Repeated it with markup-bearing attacker text as the form label and a private value
   in each submitted form.

## Observations

- All four pages display the confirmed target highlight and the completed exact-draft
  result after one passing browser run.
- Dynamic insertion does not require a separate setup or verification path.
- Client routing reaches `/lead-complete` without losing the evidence run.
- Attacker markup remains inert, renders only as clipped text in the page-owned label,
  and creates no injected image.
- Private values remain in the page-owned form only. They and the attacker markup are
  absent from the provider verification request and assistant state.
- Every case creates immutable `version-8`; publication remains a separate unavailable
  action and nothing is published.

## Findings

- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- Focused headless Chromium matrix: 4 journeys passed.
- Focused headed Chromium matrix: 4 journeys passed.
- Captures: `static-exact-preview.png`, `dynamic-exact-preview.png`,
  `client-routed-exact-preview.png`, and `adversarial-exact-preview.png` under the
  focused Playwright result directories.
- `npm run verify`: 411 deterministic tests and 70 Chromium journeys passed.
