# Managed replacement safety review

Date: 2026-08-23

Build: `feat/semantic-navigation-scopes` before commit.

## Scenarios

1. Primary: reviewed a ready two-change form plan. The selected form remained
   highlighted and the plan named both creates.
2. Conflict: supplied a same-name managed tag with different semantics. The workbench
   explained that the existing setup differs, offered no apply action, and sent no
   resume request.
3. Adversarial: supplied an authority-escalating workflow response that claimed
   publication and contained a private sentinel. The workbench rendered a bounded
   blocked state, exposed neither value, and offered only return to plan.

## Findings

- Medium, resolved: the conflict summary began above the internally scrolled viewport.
  The visible decision line now repeats the reason and explicit replacement boundary;
  the Chromium regression asserts the exact text.
- No unresolved blocker, high, medium, or low finding.

## Evidence

- `packages/core/src/change-plan.test.ts` covers managed destination and success-trigger
  changes.
- `apps/api/src/google-application.test.ts` proves no provider call or entity write.
- `tests/e2e/conversational-form.spec.ts` covers the visible conflict, absent apply
  action, absent resume request, and authority-escalating response.
- `npm run verify` passed 278 deterministic tests and 44 Chromium journeys.
