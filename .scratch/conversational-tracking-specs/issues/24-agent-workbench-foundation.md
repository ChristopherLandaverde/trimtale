# Replace scripted chat with a task-centered agent workbench

Status: active

Blocked by: 23

## Objective

Make the website surface behave like one site-aware analytics agent that owns a task,
uses current page/GTM context automatically, shows a compact plan and action receipts,
asks only for genuine decisions, and preserves deterministic execution and approval
boundaries.

This issue is stacked on issue 23 so useful interface work can continue while the
disposable GA4 property has no Realtime rows. It must not be merged before its base.

## Regression contract

Permanent regressions live in `packages/core/src/agent-turn.test.ts`,
`tests/e2e/conversation-intake.spec.ts`, `tests/e2e/conversational-form.spec.ts`, and
`tests/e2e/connected-verification-evidence.spec.ts`. Reviewed stable states are kept in
the corresponding Playwright snapshot directories.

### Agent turn

- A versioned, runtime-safe agent-turn contract contains one bounded goal, task status,
  concise summary, ordered plan stages, one optional question, safe actions, and action
  receipts derived only from validated context.
- The first implementation may use the deterministic interpreter, but the contract is
  provider-neutral so a later evaluated model can propose the same grounded shape.
- No turn contains selectors, HTML, field values, cookies, storage, credentials, raw
  provider output, evidence verdict invention, or mutation authority.

### Continuous task experience

- Sending a supported tracking intent creates one task card rather than simulated
  word-by-word canned chat.
- The card shows what the agent is working on, what it already inspected, what is
  active, what remains, and the shortest genuine user decision.
- Target and success-evidence choices update the same task instead of restarting the
  conversation or appending another scripted exchange.
- Existing connected GTM context is used as an action receipt; the person is not asked
  to restate account/container details already known.
- Evidence paths remain inspectable receipts and never expose chain of thought.

### Authority and fallback

- Setup confirmation remains an approval checkpoint; generation, verification, GTM
  writes, and publication retain their existing independent guards.
- Unsupported, ambiguous, offline, and insufficient-evidence states remain honest and
  keep the composer usable.
- If a future model is disabled, slow, invalid, or unavailable, the deterministic agent
  turn remains usable without pretending model interpretation occurred.

## Work

- Define the agent-task, plan-stage, action-receipt, and approval-checkpoint language.
- Add a provider-neutral agent-turn contract and deterministic adapter.
- Replace delta-streamed canned response bubbles with an in-place task workbench.
- Preserve accessible actions, corrections, evidence, privacy, and visual stability.
- Add built-extension happy, correction, unsupported, adversarial, and visual coverage.

## Done when

- A natural form intent produces one grounded task with a visible plan and no redundant
  GTM/account question.
- Choosing a target advances the same task to review without chat-bubble choreography.
- The existing confirmed setup and verification workflow still works through the task.
- Full local, exact-base, stacked PR, and CI gates pass after issue 23 is mergeable.

## Comments

- 2026-08-23: Claimed after the product owner identified that the safe deterministic
  workflow felt like a legacy chatbot. Canonical language now distinguishes the
  site-aware analytics agent, agent task, bounded tool action, action receipt, approval
  checkpoint, and collection acknowledgement.
- 2026-08-23: Implemented the versioned agent-turn contract and one in-place task from
  intake through verification. Focused and full gates pass 273 deterministic tests and
  36 Chromium journeys. Exploratory review fixed clipped task headers and lingering
  assistant terminology; no blocker/high finding remains. The issue stays active only
  because its stacked base, issue 23, still requires live GA4 Realtime evidence before
  this branch can become mergeable.
- 2026-08-23: Product-owner walkthrough accepted the task-centered UX and rejected the
  Northstar fixture as a useful interactive review target. Fixtures remain automation
  infrastructure only. Future practitioner walkthroughs default to an explicitly
  authorized GTM-connected site such as ConsentFlow and begin with visible access and
  destination context.
