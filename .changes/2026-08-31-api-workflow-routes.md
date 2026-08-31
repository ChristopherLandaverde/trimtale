# Extract API workflow routes

Change record version: 2

Issue: `.scratch/phase-1-refactor-scope/issues/05-api-workflow-handlers.md`

## Summary

Moved the API server's `/api/google/workflows/*` route handling into
`apps/api/src/workflow-routes.ts`.

## Why

This completes the Phase 1 refactor scope by separating workflow HTTP handling from
the main server file while keeping the completed local product loop intact.

## Behavior

No endpoint path, status code, bounded error, OAuth guard, CORS behavior, feature
flag, publication, browser verification, or rollback behavior is intended to change.

## Regression coverage

Existing workflow runner, publication, extension controller, and browser E2E coverage
remain authoritative for the extracted route behavior.

## Verification

- `npm run check` passed.
- `npm test -- apps/api/src/workflow-runner.test.ts apps/api/src/google-publication.test.ts apps/extension/src/evidence-capture.test.ts apps/extension/src/workflow-bridge.test.ts apps/extension/src/setup-operation-presenter.test.ts` passed.
- `npm run build` passed.
- `npx playwright test tests/e2e/navigation-extension.spec.ts` passed: 17/17.
- `npm run verify` passed: preflight, change docs, typecheck, 292 Vitest tests,
  and 45 Playwright E2E tests.

## Exploratory review

Not applicable: this is an internal route extraction with no intended user-visible
behavior change. Existing browser E2E covers the affected assistant workflow.

## Documentation

Updated `.scratch/phase-1-refactor-scope/spec.md` and resolved
`.scratch/phase-1-refactor-scope/issues/05-api-workflow-handlers.md`.
