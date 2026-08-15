# Navigation Tracking MVP

Status: accepted

## User outcome

A tracking practitioner opens a Chrome side panel on a public lead-generation website, asks to track navigation clicks, confirms the discovered navigation scope, downloads a GTM-compatible container file, imports it into a new workspace, and performs a guided browser check without manually constructing GTM entities.

## Supported path

- Chrome extension user interface backed by a small HTTP API.
- One consistent GA4 event named `navigation_click`.
- Event parameters: `link_text` and `link_url`.
- Desktop navigation currently present in the active page DOM.
- Practitioner confirms every included element.
- Generated file contains ordinary GTM entities and required built-in variables.
- Practitioner imports using Merge into a new GTM workspace.
- Practitioner starts GTM Preview manually.
- Extension guides clicks and observes browser-side evidence.

## Out of scope

- Direct GTM mutation or publishing.
- Automatic Google Ads or GA4 platform confirmation.
- Unrestricted site crawling.
- Form submissions and `generate_lead`.
- Automatic statistical confidence percentages.
- Mobile viewport emulation and fully automated Playwright journeys.

## Acceptance criteria

- [x] Extension discovers header, navigation, menu, and footer links on the active page.
- [x] Duplicate links are collapsed while their DOM identity remains stable.
- [x] No GTM file is generated until the practitioner confirms a non-empty scope.
- [x] Backend rejects unsupported intents and malformed measurement IDs.
- [x] Generated file contains one link-click trigger and one GA4 event tag.
- [x] Generated trigger is limited to confirmed link URLs.
- [x] UI clearly instructs Merge into a new workspace, never Overwrite.
- [x] Guided verification records the clicked element and matching analytics request evidence.
- [x] Result distinguishes browser verification from platform confirmation.
- [x] Domain generator and evidence evaluator have automated tests.

## Success measures

- A supported setup can reach browser verification in under ten minutes.
- Every scenario-corpus case produces its expected verdict.
- No browser-only result claims platform confirmation.

## Security and privacy

- Send structured navigation metadata, not full page HTML.
- Exclude form values, cookies, storage, and arbitrary page text.
- Keep model and service secrets on the backend.
- Treat all page-derived data and extension messages as untrusted input.
