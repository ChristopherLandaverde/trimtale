# Connect live publication verification and rollback

Delivery mode: implementation
Status: resolved

## Production outcome

After Google confirms publication, the website agent runs the confirmed interaction
against the live container, binds the resulting browser evidence to the published
version fingerprint, completes a passing operation, and offers an exact prior-version
rollback only when the live evidence fails.

## Non-goals

- Automatic rollback.
- GA4 reporting or attribution confirmation.
- Portal identity, tenancy, or operation history.
- Draft repair or a generalized diagnosis workflow.
- Changing the exact-preview or publication-approval boundaries.

## Authorization

The user explicitly authorized continuing with the next implementation slices on
2026-08-26. This slice continues Issue 09's accepted post-publication work.

## Regression contract

- `apps/api/src/workflow-runner.test.ts` proves live evidence is accepted only for the
  exact published fingerprint, a passing run completes the operation, a failing run
  records the exact prior-live rollback target, and rollback remains an explicit
  fingerprint-bound action.
- `tests/e2e/conversational-form.spec.ts` proves publication exposes a live browser
  run, passing evidence reaches completion, failed evidence alone exposes rollback,
  and private form values never cross the extension boundary.
- The exploratory Chromium review covers the happy path, a failed live run, and an
  attacker-shaped page value without unresolved blocker or high-severity findings.

## Dependencies

- Issue 06 exact-preview evidence and version gate.
- Issue 09 exact-version approval, publication, and rollback foundations.

## Comments

- 2026-08-26: Connected published operations to live browser evidence, durable
  completion, failed-evidence rollback eligibility, a separate exact rollback review,
  and the existing fresh-state Google rollback guard. Inconclusive evidence remains
  retryable and cannot unlock rollback. `npm run verify` passed 406 deterministic tests
  and 62 Chromium journeys; headed exploratory review found no unresolved issue.
