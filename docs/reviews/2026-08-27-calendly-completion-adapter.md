# Calendly completion adapter review

Date: 2026-08-27

## Environment

- Built production core, API, fixture site, verification target, and extension.
- Chromium with local routes standing in for the exact Calendly and attacker origins.
- The deterministic fixture exercised the production-generated listener and browser
  evidence path; it is not represented as proof from the real Calendly service.

## Scenarios

1. Detected and highlighted one supported Calendly inline iframe, reviewed its exact
   provider signal and privacy boundary, and generated two separately reviewable GTM
   actions.
2. Applied and validated the workspace draft, opened exact Tag Assistant Preview,
   received one valid completion, and created an immutable container version.
3. Sent a completion from a forged origin and another from a same-origin but
   different iframe source before the valid provider message.
4. Included private invitee, scheduled-event, and time fields in the valid callback,
   then repeated the valid message.
5. Loaded a direct Calendly iframe and a page with two supported inline embeds.

## Observations

- The setup review stated the exact origin, provider event, normalized data-layer
  event, current-page scope, consent requirement, sent fields, and excluded callback
  fields before generation.
- Wrong-origin and wrong-source messages remained inert. The valid source produced
  one normalized event and one matching GA4 request; its duplicate produced neither.
- Callback payload fields did not enter generated setup artifacts, visible UI, or
  retained browser evidence. GA4's automatic `page_location` can still include the
  current page query, so the privacy contract does not make a broader claim about
  GA4 automatic collection.
- Direct and multiple-embed pages visibly explained why setup could not continue and
  offered no setup approval action.
- The supported review and completed-version states remained legible at the tested
  viewport, and the Calendly iframe highlight did not obscure page controls.

## Findings

- High, resolved: the initial listener captured the iframe only at DOM Ready, which
  could miss a widget injected later. It now resolves the single recognized iframe at
  message time, with a regression covering late injection.
- No unresolved blocker, high-, medium-, or low-severity finding.

## Evidence

- Focused core suites: 38 tests passed.
- Deterministic repository suite: 449 tests passed.
- Focused Calendly Chromium journeys: 2 passed.
- Visual artifacts: `calendly-setup-review.png` and
  `calendly-verified-version.png` in the Playwright test output.
- Full verification: 449 deterministic tests and 78 Chromium journeys passed.
