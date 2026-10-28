# Present a multi-activity measurement plan

Delivery mode: implementation
Status: resolved

## Production outcome

When one explicitly enabled intake interpretation returns two to twelve valid
conversion-outcome and observed-interaction pairings, the website agent presents one
bounded measurement plan instead of collapsing them into an unknown task. Every item
shows its outcome, interaction, privacy-filtered observable grounding, and a
deterministic status derived from current page evidence and exact GA4 automatic
coverage.

The plan recommends but never selects one startable item. A tracking practitioner may
start exactly one ready or already-covered item; that choice reuses the validated
interpretation and enters the existing single-outcome agent task without another model
request. No setup review or approval is available on the plan itself.

The first accepted journey contains a qualified-inquiry form, a file download, and a
phone link. Exact automatic coverage marks the download already covered while the form
and phone item remain startable. Selecting the form opens the existing deterministic
lead-form task.

## Non-goals

- Batch setup generation, combined approval, parallel execution, publication, or
  verification.
- A durable setup queue, reload recovery, automatic continuation, or returning to the
  plan after a completed task.
- New interaction recipes, evidence adapters, GA4 settings, GTM mutations, or provider
  authority.
- Live model selection, paid provider calls in tests, rate limiting, spend controls,
  deployment secrets, or expansion of the intake corpus.
- The control portal, visual inventory, or organization-level plan persistence.

## Authorization

The practitioner authorized continued implementation on 2026-08-27 after selecting
the automated-workflow sequence in which one multi-activity request becomes a reviewed
measurement plan and each activity executes separately behind existing approvals.

## Regression contract

- `packages/core/src/measurement-plan.test.ts` requires a runtime-validated bounded
  measurement-plan contract, deterministic ready/covered/clarification classification,
  exact selection, and rejection of invalid or non-startable item IDs.
- `packages/core/src/agent-turn.test.ts` continues to prove that a selected plan item
  enters the existing runtime-validated single-outcome agent task.
- `tests/e2e/measurement-plan.spec.ts` requires one intercepted interpretation to show
  the three-item plan, exact automatic coverage, inert adversarial evidence, no setup
  approval, and one form selection that starts the existing lead task without a second
  interpretation request. Invalid grounding must fail closed without a plan.

## Comments

- 2026-08-27: Claimed after resolving the domain boundary: a measurement plan groups
  proposed pairings before execution; it is not an agent task, tracking change plan,
  or setup queue. ADR 0001 continues to govern authority, so no new ADR is required.
- 2026-08-27: Resolved with three focused domain regressions, five focused Chromium
  journeys, and the complete 482-test / 95-journey repository gate. The agent-owned
  production-Chromium review found one low-severity stale-evidence copy issue, fixed
  it, and found no unresolved severity. No external model or paid provider call ran.
