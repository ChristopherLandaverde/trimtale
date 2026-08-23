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
