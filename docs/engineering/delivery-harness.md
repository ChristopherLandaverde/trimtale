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
- Specifications and operational documentation updated.

Update the active `.scratch` issue as work progresses. When acceptance criteria become true, check them in the spec and record concrete evidence in the issue comments. Update `CONTEXT.md` only when domain language is resolved. Use an ADR only for a hard-to-reverse, surprising trade-off with real alternatives.

## Pull-request cadence

- Prefer one issue or independently reviewable vertical slice per pull request.
- Open a draft early after the branch has a coherent direction and push access is available.
- Continue implementing and pushing to the draft; opening it is not a pause point.
- Mark ready only when the slice is complete, documentation is current, and `npm run verify` passes.
- Stack a dependent pull request only when waiting would stop useful work; state the dependency prominently.
- Do not mix unrelated cleanup with product behavior unless it is required for the slice.

## Enforcement

`npm run check:change-docs` validates every committed change record. In pull-request CI, it also compares the branch to the base revision and fails a code-bearing change with no new record. `npm run verify` runs documentation validation before type checks, unit/scenario tests, builds, and browser E2E.

Human review remains responsible for whether the record is truthful, coverage is proportionate, and a baseline change is intentional.

## Progress without ceremony

- Documentation-only edits do not require a change record or browser run unless they alter executable examples.
- One coherent pull request needs one change record, not one per commit.
- Run focused tests during implementation and the full gate at completion.
- Record follow-up work as a separate issue instead of expanding a nearly complete slice.
- An inconclusive product result is valid; an inconclusive engineering change is not ready to merge.
