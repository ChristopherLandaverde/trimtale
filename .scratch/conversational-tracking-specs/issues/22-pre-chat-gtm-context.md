# Show GTM context before chat

Status: resolved

## Objective

When a practitioner opens the extension on a website, show the page's observed GTM
container, exact accessible account/container match, and effective backend access level
before they type an instruction.

## Regression contract

Required test levels:

- Backend recognition tests for safe account metadata.
- Extension service-worker boundary tests where practical and built-extension Chromium
  journeys for every visible state.
- Reviewed visual baselines for the matched and unavailable states.

Required states:

- Loading: opening the assistant shows a bounded checking state without blocking chat.
- Exact match: one observed public ID and one accessible API match show public ID,
  account name, container name, and read-only/container-edit/publication capability.
- Backend offline: distinguish local-service unavailability from Google disconnection.
- Google disconnected/unconfigured: explain that browser login does not establish API
  access and offer no false account identity.
- No page container: show the connected access level while saying no GTM container was
  observed on this page.
- Not accessible: show the observed public ID and that it is not in the saved grant.
- Multiple/ambiguous: list only bounded public IDs and refuse to choose a container.

Required invariants:

- Loading starts only when the assistant opens or the user explicitly refreshes; no
  account discovery occurs merely because a page loaded.
- Browser cookies and Google web-login state are never inspected.
- The current OAuth grant does not request profile/email scope, so the UI never invents
  or displays a Google email identity.
- Account/container names render as inert text after strict runtime validation.
- A public GTM ID proves page observation only; account/container access is shown only
  after an exact API match.
- The card reports effective backend capability separately from page observation.
- No credential, token, field value, raw API error, GTM write, or publication occurs.

## Work

- Include safe account identity in exact backend container recognition.
- Add a fixed status/recognition service-worker bridge with bounded identifiers and
  generic failures.
- Add the pre-chat connection card, refresh behavior, states, access labels, and styles.
- Add deterministic built-extension fixtures, accessibility checks, visual review, and
  documentation.

## Done when

- A practitioner can identify page GTM, account, container, and effective access before
  entering chat.
- Offline, disconnected, unobserved, inaccessible, and ambiguous states remain honest.
- Existing conversation and GTM workflows remain unchanged.
- Full local, exact-base, GitHub CI, and merge gates pass.

## Comments

- 2026-08-23: Claimed from a live ConsentFlow review. The saved OAuth grant was valid
  and read-only, with exact page match `Example Test Account` / `ConsentFlow
  Verification` / `GTM-XXXXXXX`, but that context was hidden until after setup and a
  manual **Check GTM access** action.
- 2026-08-23: Implemented delayed open/refresh loading, fixed-endpoint service-worker
  mediation, strict decoding, account-aware exact recognition, every required visible
  state, and reviewed matched/offline baselines. The live ConsentFlow card showed the
  expected account, container, public ID, and read-only capability before chat.
- 2026-08-23: `npm run verify` passed 264 deterministic tests across 37 files and all
  33 built-extension Chromium journeys. No browser cookie inspection, profile/email
  claim, credential exposure, GTM mutation, form submission, or publication occurred.
