# Exploratory review: forge-proof page signals

Date: 2026-10-30. Build: `fix/forge-proof-page-signals`, local API and fixture site, Playwright-managed Chromium with the unpacked extension (`apps/extension/dist`), 1280×720. For each run the assistant was driven from its visible controls (request, form choice, review, confirm, start verification), then the Contact sales form was submitted. "Received" is what the extension's isolated world actually got from the page observer, read over CDP; "page captured" is the hostile page's own log of everything it could intercept.

## Scenarios

| Scenario | Path | Verdict | Received by the extension | Page captured | Screenshot |
|---|---|---|---|---|---|
| Hostile page forging `generate_lead` signals every 25 ms, replay events, a rival handshake port, wrapped `JSON.stringify`/`dispatchEvent`/`MessagePort.prototype.postMessage`, pre-set `__trimtalePageObserver` (`?adversary=datalayer`) | adversarial | `outcome_observed_event_missing` (the true verdict) | real consent default `granted` only | nothing | [adversary_datalayer.png](2026-10-30-forge-proof-page-signals/adversary_datalayer.png) |
| Same page forging denied consent (`?adversary=consent`) | adversarial | `outcome_observed_event_missing` (before the fix: `consent_limited`) | real consent default `granted` only | nothing | [adversary_consent.png](2026-10-30-forge-proof-page-signals/adversary_consent.png) |
| AJAX success (`ajax_success`) | happy | `browser_verified` | consent `granted`, `generate_lead` with `formId: contact` | n/a | [ajax_success.png](2026-10-30-forge-proof-page-signals/ajax_success.png) |
| Consent Mode default denied (`consent_denied`) | ambiguous | `consent_limited` | consent `denied`, `generate_lead` | n/a | [consent_denied.png](2026-10-30-forge-proof-page-signals/consent_denied.png) |

The page and assistant look the same as before the change: the confirmed form is highlighted, the page's own success message shows, and the verdict card reads as in Slice 1. The fixture's `lead_email` (typed email pushed into the dataLayer) never appears in what the extension received.

## Findings

| Severity | Finding | Status |
|---|---|---|
| medium (pre-existing, not a forgery path) | When the confirmed success signal is a dataLayer event, a page that pushes that event after its endpoint returned 5xx gets `success`: an observed outcome overrides the response failure in `FormRun`. The page really pushed the event (GTM saw it too), so this is a verdict-precedence question, not forgery. | Follow-up: decide whether an observed server error should outrank a dataLayer-only outcome. Not changed here. |
| low | A page can still tell that something polls `window.dataLayer` (a getter on `window.dataLayer` sees the reads), so a hostile site could detect a verification in progress and behave differently. | Documented in `docs/security-and-publishing.md`. Fixing it would mean replacing `dataLayer.push`, which the observer deliberately never does. |
| low | Playwright `addInitScript` runs before extension `document_start` scripts, so a test harness (not a real page) could intercept the handshake. Real page scripts cannot run before `document_start`. | Documented here; the pre-set-flag regression uses `addInitScript` and still passes. |

No blocker or high-severity findings.
