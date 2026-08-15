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
