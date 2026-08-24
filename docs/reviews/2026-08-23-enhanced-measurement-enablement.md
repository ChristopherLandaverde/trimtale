# Enhanced-measurement enablement review

Date: 2026-08-23

Build: `feat/semantic-navigation-scopes` before commit.

## Scenarios

1. Primary: opened the review for one exact property and stream, confirmed the stated
   master-switch-only boundary, and received the enabled audit state.
2. Negative: cancelled review and confirmed no write request occurred.
3. Inconclusive: returned malformed success data. The UI kept the switch off, exposed
   no provider text, and offered a retry.
4. Adversarial: used markup-bearing page input and provider data. Neither entered the
   rendered review.

## Evidence

- The compact review and rejected-response states were visually inspected in built
  Chromium.
- The focused journey passed cancellation, malformed response, retry, and success.
- Backend tests proved a fresh exact-stream read and a `stream_enabled`-only PATCH.
- The initial exploratory pass used fixtures and changed no live Google setting.

## Live execution

After separate approval, the saved Google session requested Analytics edit consent.
The guarded action re-read `G-YV879ECLRV`, property `550074997`, stream
`15443100029`, with the master switch off and all seven feature toggles on. It then
updated only `stream_enabled`. An independent read-back reported the master switch and
all seven features on. GTM and publication remained unchanged. The temporary
edit-enabled API session was stopped afterward.

Post-change Playwright used ordinary page load, gradual scrolling, and one existing
GitHub link. GA4 returned HTTP 204 for `page_view`, `scroll`, and outbound `click`.
Browser-only proof targets then returned HTTP 204 for `file_download`, an SPA-history
`page_view`, and `view_search_results`. Only the measurement ID, event name, sanitized
origin/path, and status were retained.

ConsentFlow has no native download, search form, lead form, or video target. A
temporary dynamic form did not produce repeatable submit evidence, so this review does
not claim automatic form-submit or video runtime proof. Confirmed lead tracking remains
the separate evidence-based workflow.

## Findings

- Medium, resolved: the first review appended below the full coverage card and hid its
  heading. Review now replaces the card body and keeps the destination and authority
  boundary visible.
- Medium, open: the deterministic intake currently classifies `track downloads` as
  unknown even though the connected audit and live runtime can prove automatic file
  downloads. Issue 35 scopes that product-language gap without adding a custom GTM
  generator implicitly.
- No blocker or high finding remains.
