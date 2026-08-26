# Customer evidence-surface review

Date: 2026-08-25

Build: current production extension after `npm run verify`.

Target: deterministic local form and navigation pages in Chromium with controlled
GTM/GA4 context.

## Scenarios

1. Completed a confirmed-lead browser run with successful GA4 Realtime confirmation.
2. Repeated the run while the Analytics provider denied the baseline read.
3. Selected navigation targets containing attacker-shaped visible text.

## Evidence

- The completed task showed action receipts and one concise browser/platform result;
  the eight-stage Evidence path was absent.
- The provider-denied task preserved the passing browser result, labeled platform
  confirmation unavailable, explained the bounded retry, and exposed the retry action.
- Raw provider detail and the submitted email remained absent from the assistant.
- Attacker-shaped page text rendered literally in the selector and page marker without
  creating an image or script element or executing the payload.
- The page markers, GTM/GA4 connection card, task state, and input remained visually
  distinct at the compact overlay size.
- Replacement visual baselines cover the confirmed navigation and connected result
  states. Three focused exploratory Chromium journeys passed after the full gate.

## Findings

- No blocker or high-severity finding remains.
