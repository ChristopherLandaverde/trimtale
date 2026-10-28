# Automatic-coverage intent review

Date: 2026-08-25

Build: current working tree.

Target: deterministic local fixture site with the built production extension and
controlled exact-stream GTM/GA4 responses.

## Scenarios

1. Requested page views, scroll depth, internal site search, and video engagement with
   the exact stream's corresponding automatic features enabled.
2. Requested scroll tracking with the exact stream's scroll feature disabled.
3. Requested scroll tracking when the Enhanced Measurement response was malformed and
   therefore unavailable.
4. Added instruction-shaped attacker text to the page before requesting coverage.

## Evidence

- Each enabled feature rendered `Already covered`, named `G-TEST123456`, and exposed no
  setup, review, approval, preparation, or download action.
- The disabled scroll feature rendered `Coverage gap · Scrolls`, named the exact
  setting and stream, and generated no fallback setup.
- Malformed settings rendered `Check automatic coverage · Scrolls`; the agent did not
  assume coverage or generate setup.
- The overlay kept its task, plan, receipts, and input readable alongside the page.
  Attacker-shaped page text remained on the page and did not enter the agent task.
- Visual inspection found the inherited `Review tracking setup` plan label misleading
  for a no-setup decision. The plan now says `Check automatic coverage`, `Avoid
  duplicate setup`, and `Verify measurement`; a permanent core assertion protects it.

## Findings

- No blocker or high-severity finding remains.
- Low: compact-overlay autoscroll can partially clip the small task eyebrow when a gap
  task is taller than the available response area. The goal, gap explanation, plan,
  receipts, and input remain visible. This is deferred with the broader UI-polish work.
- Final `npm run verify` passed 399 deterministic tests and all 58 Chromium journeys.
