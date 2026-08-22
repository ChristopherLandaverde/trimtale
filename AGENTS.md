# Agent Instructions

## Agent skills

### Issue tracker

Issues and specifications are stored as local Markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

This repository uses a single-context domain layout. See `docs/agents/domain.md`.

## Engineering harness

Agents own the local development and verification loop. Do not ask the user to run repository commands or operate Chrome for tasks the harness can perform.

- `npm run check` — strict TypeScript checks across every workspace.
- `npm test` — deterministic domain and scenario-corpus tests.
- `npm run test:e2e` — builds the project, starts local services, launches Chromium with the extension, and exercises the complete supported workflow.
- `npm run verify` — required completion gate; runs all checks, tests, builds, and browser E2E tests.

Playwright retains failure screenshots and traces under `test-results/`. The E2E workflow uses only local fixture services. Real Google integration tests must be separately gated by explicit credentials and disposable resources.

Before completing a change, run `npm run verify` and report the evidence. Never delegate this command to the user.

## Change documentation and pull requests

- Read `docs/engineering/delivery-harness.md` before changing product behavior, contracts, persistence, security boundaries, or test infrastructure.
- Every code-bearing pull request must include one concise change record under `.changes/`; use `.changes/template.md` as the format.
- Update the relevant `.scratch/<feature>/spec.md` acceptance criteria and issue comments when implementation changes the documented state of an effort.
- Add permanent regression coverage in the same change as new accepted behavior. Do not delete or weaken an existing regression without documenting the product decision in the change record.
- Keep pull requests to one reviewable vertical slice. Open a draft pull request early when remote collaboration is available; a draft is a visibility mechanism, not a reason to pause local implementation.
- Pull-request descriptions must identify the issue/spec, behavior change, regression evidence, documentation updates, risk, and rollback approach. Use `.github/pull_request_template.md`.
