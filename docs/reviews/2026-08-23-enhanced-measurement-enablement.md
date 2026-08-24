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
- ConsentFlow was not called and no live Google setting changed.

## Findings

- Medium, resolved: the first review appended below the full coverage card and hid its
  heading. Review now replaces the card body and keeps the destination and authority
  boundary visible.
- No unresolved finding remains.
