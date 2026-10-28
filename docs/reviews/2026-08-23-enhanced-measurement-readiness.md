# Enhanced-measurement readiness review

Date: 2026-08-23

Build: `feat/semantic-navigation-scopes` before commit.

## Scenarios

1. Primary: opened one exactly recognized GTM/GA4 context with all enhanced-
   measurement settings enabled and saw `7 of 7 automatic features on`.
2. Negative: reviewed partial coverage and a disabled master switch. The card named
   each ineffective feature and kept confirmed lead outcomes separate.
3. Adversarial: returned a malformed settings object with markup-bearing provider
   names. The recognized GTM context remained visible, the check became unavailable,
   and no provider text rendered.
4. Live read: used the saved ConsentFlow grant to read property `550074997`, stream
   `15443100029`, and `G-YV879ECLRV`. The master switch is off while all seven feature
   toggles are configured on; effective automatic coverage is therefore zero.

## Evidence

- The master-off connection-card baseline was visually inspected after the built
  Chromium journey.
- Focused API tests passed seven provider, default-decoding, and failure cases.
- Focused connection-card tests passed complete, partial, master-off, malformed,
  offline, ambiguous, and inaccessible paths.
- The live check used `analytics.readonly`; publication remained off and no update
  endpoint was called.

## Findings

- Medium, resolved: Google ProtoJSON omits `false` booleans. The initial decoder treated
  omission as malformed; omitted fields now decode to the specified `false` default.
- Low, resolved: `0 of 7` did not explain the master switch. The card now says
  `Master switch off · 0 of 7 active`.
- No blocker, high, medium, or low finding remains.
