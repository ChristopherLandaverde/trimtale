# Establish the site-aware agent workbench

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/24-agent-workbench-foundation.md`

## Summary

The extension now maintains one task-centered agent workbench from intent through
setup review and verification. A versioned, provider-neutral turn contract replaces
simulated token streaming while deterministic tools retain evidence and mutation
authority.

## Why

The previous safe workflow presented a scripted wizard as chat, which made progress,
context use, approvals, and final evidence feel fragmented. Practitioners need one
obvious task, the context already inspected, the current decision, and a trustworthy
result without repeatedly restating GTM or page facts.

## Behavior

- Supported form intents create one in-place task with goal, status, ordered plan,
  action receipts, shortest useful decision, approval checkpoint, and structured
  verification result.
- Target selection, setup review, approval, download, verification readiness, browser
  verdict, and GA4 confirmation advance that same task instead of appending canned
  assistant bubbles.
- Exact recognized GTM/GA4 context appears as a safe receipt and is reused without a
  redundant account or container question.
- Unsupported and insufficient-evidence work remains honest and leaves intake usable;
  invalid agent-turn messages fail closed.
- Setup generation, browser verdicts, GA4 correlation, GTM writes, publication, and
  rollback retain their existing independent authority and approval guards.
- Real model interpretation, provider routing, multi-tool diagnosis, tracking writes,
  collection acknowledgement, and publication controls are out of scope.

## Regression coverage

- `packages/core/src/agent-turn.test.ts` covers grounded ambiguous intake, safe
  connected receipts, in-place-ready review shape, prompt/page-internal omission,
  unsupported and insufficient states, completion status, and schema rejection.
- `tests/e2e/conversation-intake.spec.ts` proves one task remains through target and
  review transitions, unsupported intake is honest, the composer remains usable, and
  candidate highlights still align with actions.
- Existing built-extension form and connected-evidence journeys now assert structured
  setup and verification results, provider denial, private-value omission, and exact
  GA4 confirmation inside the workbench.
- Intentional assistant, task, target-highlight, evidence, and managed-workspace visual
  baselines were regenerated only after focused behavior passed and every changed image
  was reviewed.

## Verification

Focused core contract tests passed 3/3. Extension strict type checking and build passed.
Focused Chromium agent, form, connection, evidence, and navigation journeys passed
after intentional baseline review. A complete `npm run verify` passed local preflight,
38 change records, every strict check and build, 273 deterministic tests across 39
files, and all 36 Chromium journeys.

## Exploratory review

[`docs/reviews/2026-08-23-agent-workbench-foundation.md`](../docs/reviews/2026-08-23-agent-workbench-foundation.md)
records the supported form task, completed and blocked verification, exact connected
context, offline and unsupported intake, ambiguous evidence, attacker-shaped provider
names, and private sentinels. Two medium terminology/layout findings were fixed and
regressed; no blocker or high-severity finding remains.

## Documentation

The domain glossary, agent/tool authority ADR, accepted conversational specification,
current-capabilities inventory, product-plan interaction guidance, roadmap, issue 24,
and this change record define the new task-centered surface and its boundaries.

## Rollback

Revert this change to restore deterministic assistant-response rendering. The
underlying intake interpreter, tracking specifications, setup generators, evidence
paths, GTM/GA4 clients, and publication guards remain independently reversible.
