# Stabilize the form-candidate highlight visual

Status: resolved

## Objective

Remove first-attempt rendering instability from the conversation-intake candidate
highlight screenshot without accepting an unexplained visual baseline change.

## Regression contract

`tests/e2e/conversation-intake.spec.ts` must pass repeated focused Chromium runs with a
stable `form-candidate-highlights.png` comparison. The investigation must inspect the
failure artifact and distinguish font loading, animation, layout, service readiness,
and genuine product rendering differences. Any intentional snapshot update requires a
recorded visual review; retry success alone is not approval.

## Comments

- 2026-08-23: Merged-main run `32619438610` passed overall but marked the conversation
  intake journey flaky. The first screenshot comparison differed by 3,293 pixels (1%)
  at `tests/e2e/conversation-intake.spec.ts:55`; Playwright's retry passed without a code
  change. No baseline was updated.
- 2026-08-23: Claimed after workflow hardening merged in PR #33. The historical log
  shows two identical mismatching captures 100 ms apart after animations were disabled
  and fonts reported loaded; a fresh-worker retry passed. Twenty consecutive local
  fresh-profile repetitions passed, ruling out an ordinary active animation or a
  consistently changed baseline. Investigation is focusing on one-time Chromium font
  and shadow-root layout initialization before considering any snapshot change.
- 2026-08-23: The document had screenshot typography installed before interaction, but
  the candidate-label shadow root received it only temporarily during capture. The
  journey now installs that same screenshot-only CSS in the target shadow root before
  measurement and asserts Arial there; assistant and production styles are untouched.
  The accepted baselines passed unchanged across 20 consecutive fresh profiles, five
  isolated cold-cache launches, and the full 25-workflow Chromium gate. `npm run
  verify` also passed all 202 deterministic tests across 29 files. No snapshot was
  updated.
- 2026-08-25: Reopened after the full 55-journey gate and a focused retry both produced
  the same 13,911-pixel difference for `form-confirmed-highlight.png`. The behavioral
  assertions passed, and no baseline was updated. Reinspect the accumulated Stage 1 UI
  changes against the expected image before deciding whether this is intentional or a
  rendering regression.
- 2026-08-25: Expected, actual, and diff inspection found no form-highlight change. The
  full-page snapshot coupled the page target to a 16px assistant scroll difference; a
  five-run diagnostic also exposed an independent one-pixel shell drift. The two
  baselines now hide the assistant only during capture, show both page forms without
  occlusion, and restore the assistant for the remaining workflow assertions. The
  isolated contract passed ten consecutive fresh-profile runs. Visual review:
  `docs/reviews/2026-08-25-form-highlight-visual-isolation.md`.
- 2026-08-25: The full gate exposed the same one-pixel parent-width toggle in two
  element-level Enhanced Measurement screenshots. Their test surfaces now use the
  approved 348px border-box width before capture; both unchanged baselines passed 20
  consecutive fresh-profile runs. Final `npm run verify` passed all 392 deterministic
  tests and 55 Chromium journeys.
