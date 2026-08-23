# Stabilize the form-candidate highlight visual

Status: open

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
