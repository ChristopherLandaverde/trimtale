# Delivery and Regression Harness

## Purpose

The harness lets the product advance in small vertical slices while preserving accepted behavior, evidence quality, privacy boundaries, and documentation. It makes regressions visible and reviewable; it does not freeze intentional product evolution.

## One continuous loop

```text
accepted spec
  -> executable regression contract
  -> claimed issue
  -> implementation plus permanent regression
  -> change record and issue update
  -> npm run verify
  -> automated complete-journey review
  -> exploratory Chromium review
  -> remediate findings and add regressions
  -> draft PR updated as work progresses
  -> reviewable PR evidence
  -> merge
```

Do not wait for an entire multi-issue effort before integrating completed foundations. Each pull request should complete one independently understandable slice and leave the repository green.

## Test-first issue contract

Every implementation issue starts by defining its regression contract. The contract names the invariant, test level, fixtures, positive case, negative case, and expected evidence or verdict.

If the behavior can run, write the behavioral test first and implement until it passes. If downstream dependencies do not exist, commit a schema-validated acceptance fixture rather than a skipped or intentionally failing test. The fixture is executable as contract validation immediately and must later be consumed by the real unit, scenario, or E2E test. This lets dependent work move forward while keeping `main` green.

An issue cannot become `resolved` until:

- Its behavioral test runs in `npm test` or `npm run test:e2e`.
- Positive, negative, and inconclusive behavior are covered when applicable.
- The issue names the concrete test files under `## Regression contract`.
- Any acceptance fixture created earlier is consumed by the behavioral test rather than duplicated or abandoned.

Skipped tests, `test.todo`, and fixtures that are never loaded by the harness do not satisfy the contract.

## Automated complete-journey review

User-visible workflows must be driven through a reusable Playwright journey harness before exploratory review. The acceptance fixture—not duplicated test code—defines the intent, clarifications, fixture state, expected artifact, evidence, verdict, next-action concepts, and forbidden claims.

For each journey, automation should:

1. Launch Chromium with the unpacked extension and deterministic local services.
2. Begin from the visible chat surface and use accessible controls for every practitioner action.
3. Assert page effects such as candidate and confirmed highlights.
4. Validate generated artifacts semantically after removing timestamps and irrelevant identifiers.
5. Execute the local site behavior and collect the same evidence the product displays.
6. Assert the deterministic verdict and platform-confirmation boundary.
7. Score the conversational explanation against required concepts and forbidden claims rather than exact prose.
8. Repeat critical journeys when race, duplication, reload, or listener regressions are plausible.

This automated review catches known behavior continuously. Exploratory review remains responsible for discovering missing expectations and converting confirmed findings into permanent regressions.

## Exploratory Chromium review

Automated checks prove the behavior they encode; they do not prove that the encoded expectations are complete. Every user-visible slice therefore has an agent-owned exploratory review after `npm run verify` and before the issue is resolved or the pull request is marked ready.

The agent must:

1. Build the current branch and launch Chromium with the unpacked extension against the deterministic fixture site.
2. Exercise the primary workflow from the visible UI without bypassing steps through direct APIs.
3. Exercise at least one ambiguous, negative, unsupported, or insufficient-evidence path.
4. Compare visible behavior with the user outcome, domain language, evidence boundaries, and existing UX baselines.
5. Inspect both the overlay and the affected page—for example target highlights, focus, evidence labels, and persistence after collapse or reload.
6. Record the environment, scenarios, observations, screenshots when useful, and findings under `docs/reviews/YYYY-MM-DD-description.md`.
7. Classify each finding as blocker, high, medium, or low. Create or claim a remediation issue for confirmed blocker/high findings immediately.
8. Add permanent automated coverage when the finding is fixed so the same regression cannot silently return.

A user-visible issue may resolve only when its review has no unresolved blocker/high findings. Medium and low findings may become linked follow-up issues when they do not invalidate the accepted user outcome.

Exploratory review does not require the user to operate Chromium or describe what went wrong. It is part of the agent-owned completion gate.

## Regression tiers

### Contract regressions

Protect versioned tracking specifications, scenarios, run evidence, verdicts, and persistence formats with runtime-validation, round-trip, invalid-input, and migration tests in the shared package.

### Domain and verdict regressions

Put deterministic evidence-to-verdict cases in the scenario corpus. Every accepted verdict needs positive, negative, and inconclusive coverage. A case that once exposed an undetected error becomes permanent.

### Generator regressions

Compare generated GTM output semantically after normalizing irrelevant identifiers and ordering. Protect event names, trigger conditions, required variables, parameter mappings, confirmed scope, and the absence of production publishing.

### Conversation regressions

Use structured transcript/state fixtures to protect classification, clarification, correction, confirmation, unsupported intents, and safe handoff behavior. When an LLM is added, keep deterministic state assertions and add scored evals rather than asserting exact prose.

### Privacy and security regressions

Use sentinel values to prove that form values, cookies, storage, credentials, and arbitrary page text do not enter messages, evidence, logs, generated files, or persistence. Add adversarial selectors, URLs, extension messages, OAuth state, and malformed contracts.

### Browser and site regressions

Use local fixtures and Playwright for native, redirect, AJAX, SPA, dynamic, multi-target, consent, delay, duplication, and insufficient-evidence cases. Real Google tests stay separately credential-gated.

### UX and accessibility regressions

Protect stable states with role/name assertions, keyboard and focus tests, accessibility checks, and reviewed screenshots. A changed screenshot is evidence requiring approval, not an automatic prohibition on UX improvement.

Update an intentional Chromium baseline with:

```bash
npm run build
npx playwright test tests/e2e/navigation-extension.spec.ts --update-snapshots
npm run verify
```

Review every generated image and the Git diff before committing it. Never update snapshots merely to make a failing gate green.

### Reliability and performance regressions

Repeat critical journeys to detect races, duplicate listeners, late requests, reload behavior, and multi-tab interference. Establish generous measured budgets before enforcing mount time, discovery time, bundle size, memory, or artifact-size thresholds.

## Test placement

| Concern | Location | Gate |
|---|---|---|
| Shared contracts and verdict rules | `packages/core/src/*.test.ts` | `npm test` |
| API, OAuth, persistence, and privacy | `apps/api/src/*.test.ts` | `npm test` |
| Extension units and conversation state | `apps/extension/src/*.test.ts` | `npm test` |
| Deterministic site variants | `apps/fixture-site/` plus scenario fixtures | `npm test` and E2E |
| Complete browser workflows and visual states | `tests/e2e/` | `npm run test:e2e` |
| Real Google compatibility | Explicit-credential integration lane | Never ordinary `verify` |

Vitest discovers workspace tests through the existing configuration. Playwright discovers browser journeys under `tests/e2e`. Failure traces, screenshots, and reports remain CI artifacts.

## Documentation contract

Each code-bearing pull request includes one `.changes/YYYY-MM-DD-description.md` record with:

- What changed and why.
- Supported, unchanged, and out-of-scope behavior.
- Permanent regression coverage.
- Verification evidence.
- Exploratory Chromium review evidence for user-visible changes, or a concise explanation that the change has no user-visible surface.
- Specifications and operational documentation updated.

Update the active `.scratch` issue as work progresses. When acceptance criteria become true, check them in the spec and record concrete evidence in the issue comments. Update `CONTEXT.md` only when domain language is resolved. Use an ADR only for a hard-to-reverse, surprising trade-off with real alternatives.

## Pull-request cadence

- Prefer one issue or independently reviewable vertical slice per pull request.
- Open a draft early after the branch has a coherent direction and push access is available.
- Continue implementing and pushing to the draft; opening it is not a pause point.
- Mark ready only when the slice is complete, documentation is current, and `npm run verify` passes.
- Stack a dependent pull request only when waiting would stop useful work; state the dependency prominently.
- Do not mix unrelated cleanup with product behavior unless it is required for the slice.

### CI-parity documentation check

Before marking a pull request ready, run the same base-aware documentation validation as CI against the final committed branch:

1. Resolve the merge base with `git merge-base main HEAD`.
2. Pass that explicit revision to `npm run check:change-docs -- --base <merge-base>`.
3. Run `npm run verify` and push only after both gates pass.

Ordinary `npm run verify` validates every record's structure but does not infer a pull-request base. It therefore cannot replace the base-aware check that requires every new code-bearing pull request record to use the current record version and include exploratory-review evidence or a no-visible-surface explanation.

## Enforcement

`npm run check:change-docs` validates every committed change record. In pull-request CI, it also compares the branch to the base revision and fails a code-bearing change with no new record. `npm run verify` runs documentation validation before type checks, unit/scenario tests, builds, and browser E2E.

Human review remains responsible for whether the record is truthful, coverage is proportionate, and a baseline change is intentional.

## Command authorization discipline

Keep the local verification loop least-privileged without turning approval prompts into progress gates.

- Run read-only diagnostics such as `git status`, `ps`, `ss`, local file inspection, and local HTTP checks in the normal sandbox first.
- Escalate a command only after the sandbox actually blocks the required operation, and report the concrete failure that made escalation necessary.
- Preemptive authorization is appropriate only when the operation is inherently privileged, opens a GUI, binds a blocked local service port, reaches a restricted network, or changes state outside the workspace.
- Request approval before destructive or materially external actions unless the user has already authorized that exact scope.
- Do not request elevated access merely because a later remediation might need it. Diagnose read-only first, resolve the exact target, and escalate only the smallest required action.
- Reuse an existing narrow approval for repeated verification commands; do not broaden it to unrelated shell or process access.

For example, a Playwright run may require escalation when its local fixture server receives `EPERM` while binding a port. Inspecting which process owns that port should still run normally first; only stopping the resolved stale process may require separate authority.

Completion gates start fresh local API and fixture processes by default so a stale development server cannot produce a false result. Set `PLAYWRIGHT_REUSE_SERVERS=true` only for an intentional local debugging session after confirming the running services match the current build; never use server reuse as completion evidence.

## Progress without ceremony

- Documentation-only edits do not require a change record or browser run unless they alter executable examples.
- One coherent pull request needs one change record, not one per commit.
- Run focused tests during implementation and the full gate at completion.
- Record follow-up work as a separate issue instead of expanding a nearly complete slice.
- An inconclusive product result is valid; an inconclusive engineering change is not ready to merge.
