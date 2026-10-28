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

## Delivery modes and implementation gate

Classify work before editing runtime product code. Use the least committed mode that
answers the request:

- **Discovery** answers a question or tests an idea. Examples, comparisons, audits,
  walkthroughs, and "show how you decide" requests default to this mode. Produce notes,
  a small disposable experiment, or a narrowly isolated fixture. Do not add production
  APIs, UI workflows, persistence, provider adapters, domain terms, ADRs, generalized
  frameworks, or broad permanent test corpora.
- **Specification** decides what should be built. It may create or revise a spec,
  acceptance examples, and issue boundaries, but it does not implement product
  behavior. `Status: accepted` means the design is agreed; it is not implementation
  authorization.
- **Implementation** changes supported product behavior. Enter this mode only when the
  user explicitly asks to build, implement, change, or fix the behavior, or when the
  user explicitly selects an implementation issue whose `Delivery mode:` is
  `implementation`. This mode receives the full engineering and review harness below.

Do not promote work between modes implicitly. Before moving from discovery or
specification into implementation, state the proposed production behavior and its
non-goals, then obtain explicit user authorization. If the request is ambiguous, remain
in the current mode and ask before writing runtime product code.

Pause and request a scope decision when work would introduce any of the following but
the accepted deliverable does not name it:

- a new runtime layer, API, provider, persistence path, or user-visible workflow;
- a new permanent domain term or architectural decision;
- a generalized evaluation framework or broad scenario corpus from one example;
- compilation, mutation, scaling, security-hardening, or operational behavior adjacent
  to—but not required by—the requested outcome;
- a second independently valuable feature disguised as robustness or completeness.

Production rigor is not optional after implementation is authorized. The gate controls
whether to build; it does not weaken verification for behavior that will ship.

## FAB engineering rules

### Communication

- Use as few words as possible in comments, commit messages, and prompt replies. Pick
  every word carefully.
- Avoid superlatives, praise, and reflexive agreement. State the facts directly.

### Code

- Extract recurring or meaningful magic values into descriptive constants or enums.
  Keep self-explanatory one-off values inline. Values defined by a specification, such
  as HTTP status codes, always use constants.
- Reduce indentation. Avoid the Arrow Anti-Pattern with early returns and `continue`.
- Keep function names under 30 characters.
- Use enums instead of boolean function parameters.
- Add empty lines between logical blocks.
- Add a short comment explaining what a non-obvious block does and why. Use an example
  when useful. Propose ASCII diagrams for complete systems.
- Treat member visibility changes as breaking design shifts. Keep fields and functions
  private unless external access is required by the design. Obtain explicit user
  approval before changing an access modifier from private to internal or public.
- Program to levels of abstraction. Encapsulate lower-level mechanics, such as raw
  hardware I/O, sector parsing, or direct socket streams, behind a dedicated driver or
  abstraction. Expose domain-level APIs to calling code.
- Do not touch code unrelated to the requested feature. Do not add comments to code you
  did not create or modify. Minimize changed lines.
- Enforce adjacent-layer communication. Each layer may call only its immediate lower
  neighbor. UI and controllers must not call databases, hardware drivers, or low-level
  network clients directly; route through the intermediate abstraction.
- Always use braces, including one-line `if` statements.

### Commit messages

1. Separate the subject from the body with one blank line.
2. Limit the subject to 50 characters; 72 is the hard limit.
3. Capitalize the subject's first letter.
4. Do not end the subject with a period.
5. Use the imperative mood. It must complete: "If applied, this commit will ..."
6. Wrap body text manually at 72 characters.
7. Explain what and why in the body, not how. The code explains how.

### Bug fixes

When a prompt indicates a bug fix, write the regression test first, observe it fail,
implement the fix, and observe the test pass.

## Change documentation and pull requests

- Read `docs/engineering/delivery-harness.md` before changing product behavior, contracts, persistence, security boundaries, or test infrastructure.
- Every code-bearing pull request must include one concise change record under `.changes/`; use `.changes/template.md` as the format.
- Every claimed implementation issue must define a regression contract before product implementation begins. When dependencies do not exist yet, add a schema-validated acceptance fixture that later becomes the input to the real test; do not use a skipped or permanently failing test.
- An issue may be resolved only when its required behavioral tests exist, run in the ordinary harness, and are named in the issue's `## Regression contract` section.
- For every user-visible workflow change, perform an exploratory review in the built product after automated verification: launch Chromium with the extension, exercise the happy path, at least one negative or ambiguous path, and at least one adversarial page with attacker-shaped input, visually inspect the page and assistant state, and record the evidence under `docs/reviews/`.
- Do not mark a user-visible issue resolved while its exploratory review has unresolved blocker or high-severity findings. Create or claim remediation issues immediately; do not wait for the user to report visible gaps.
- Automated tests remain required. Exploratory review discovers incorrect assumptions and missing assertions; every confirmed regression should gain permanent automated coverage in its remediation change.
- Update the relevant `.scratch/<feature>/spec.md` acceptance criteria and issue comments when implementation changes the documented state of an effort.
- Add permanent regression coverage in the same change as new accepted behavior. Do not delete or weaken an existing regression without documenting the product decision in the change record.
- Keep pull requests to one reviewable vertical slice. Open a draft pull request early when remote collaboration is available; a draft is a visibility mechanism, not a reason to pause local implementation.
- Pull-request descriptions must identify the issue/spec, behavior change, regression evidence, documentation updates, risk, and rollback approach. Use `.github/pull_request_template.md`.
