# Surface automatic coverage in the task

Status: active

## Objective

Use the existing enhanced-measurement audit to make the main tracking task state what
GA4 already covers before offering custom setup.

## Regression contract

- `packages/core/src/agent-turn.test.ts` reports navigation as partially covered when
  enhanced outbound clicks are active and reports confirmed leads as needing custom
  setup even when automatic form interactions are active.
- A disabled master switch produces a direct `Needs setup` explanation.
- No audit context preserves the existing task behavior.
- `tests/e2e/gtm-connection-context.spec.ts` proves the visible task shows the coverage
  decision before setup generation.

## Non-goals

- Do not infer GA4 cross-domain configuration from hostnames.
- Do not remove explicitly chosen custom events.
- Do not enable GA4 settings, request edit access, or change generation.

## Done when

- A practitioner can recognize `Partially covered` or `Needs custom setup` in the
  existing task without opening the connection card.
- Full verification and exploratory Chromium review pass.

## Comments

- 2026-08-23: Claimed because the readiness audit was not recognizable in the main
  workflow and therefore did not yet produce a usable product decision.
- 2026-08-23: Implemented visible navigation and confirmed-lead coverage decisions in
  the existing agent task. Automatic outbound coverage removes `Track all`; link
  selection begins empty so a custom event remains intentional.
- 2026-08-23: Exploratory review found and resolved the conflicting `Track all`
  shortcut. No unresolved finding remains.
- 2026-08-25: The element screenshot now fixes its test-only surface to the approved
  348px border-box width before capture. This prevents a one-pixel parent-scrollbar
  change from rewrapping the task summary; 20 repeated focused cases and the full
  55-journey gate passed with the baseline unchanged.
