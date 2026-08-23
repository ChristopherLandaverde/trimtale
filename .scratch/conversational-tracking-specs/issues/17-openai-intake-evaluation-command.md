# Add the owner-operated OpenAI intake evaluation command

Status: resolved

## Objective

Connect the backend intake evaluation runner to the OpenAI Responses API through a
strict, replaceable adapter and an owner-operated offline command, without exposing
paid execution through HTTP or retaining credentials and raw provider content.

## Regression contract

Required test level:

- Deterministic API adapter tests in `apps/api/src/openai-intake-provider.test.ts`.
- Deterministic command/configuration tests in
  `apps/api/src/run-intake-evaluation.test.ts`, consuming
  `tests/acceptance/intake-interpretation.json` through the existing runner.

Required fixtures and cases:

- Positive adapter: one validated intake input produces a Responses API request with
  the configured model, `store: false`, no tools, a bounded output budget, and strict
  JSON Schema; a completed structured response returns only the interpretation and
  configured usage estimate.
- Provider failures: non-success HTTP status, malformed response JSON, incomplete
  status, missing structured output, invalid usage, refusal-shaped output, and an
  aborted request reject with generic errors that contain no response body or key.
- Command preflight: missing credentials, missing configuration, malformed config,
  unsafe or duplicate provider IDs, invalid model names, invalid costs, invalid
  timeout, invalid report path, or fewer than two/more than three providers fails
  before any provider call or report write.
- Complete run: two configured models evaluate the complete acceptance corpus through
  injected deterministic fetch responses, persist one privacy-safe report, and print
  only a compact report summary.
- Privacy: requests contain only the validated model-facing input and fixed
  instructions; command output and persisted reports contain no key, Authorization
  header, response body, exception detail, corpus message, candidate label, private
  sentinel, raw prompt, or interpretation.

Required invariants:

- The adapter uses the official HTTPS Responses endpoint and raw platform-neutral
  `fetch`; provider SDK objects do not cross the existing shadow-provider boundary.
- Pricing is explicit per configured model rather than silently hard-coded. Usage cost
  is an estimate derived from returned token counts and those rates.
- Credentials come only from the backend process environment, are never accepted in a
  checked-in config file, and are never logged or persisted.
- The command is offline and owner-operated. No server route, extension import,
  practitioner workflow, GTM mutation, or publication behavior is added.
- Ordinary `npm run verify` remains fully deterministic and sends no external request.

## Work

- Define and validate the credential-free model comparison configuration.
- Implement the OpenAI Responses API shadow-provider adapter with strict structured
  output, generic failure handling, abort propagation, and explicit cost estimation.
- Implement a dependency-injectable owner command that loads the existing corpus,
  builds two or three adapters, runs the comparison, and prints a privacy-safe summary.
- Add the explicit npm command and operator documentation without running a paid call.

## Done when

- Adapter, failure, configuration, complete-run, and privacy regressions pass in the
  ordinary deterministic harness.
- `npm run verify` and the exact-base change-documentation check pass.

## Comments

- 2026-08-23: Claimed after issue 16 established the provider-neutral runner and
  private report repository. The OpenAI API contract was checked against official
  documentation before implementation. Real execution remains dormant until an owner
  separately supplies a key, model/rate configuration, and invokes the command.
- 2026-08-23: Added the strict Responses API adapter, credential-free configuration,
  workspace-confined owner command, generic provider failures, explicit usage-cost
  estimates, and safe report summary. The 31 focused adapter and command regressions
  pass with injected local responses, and API strict TypeScript checking passes. No
  external or paid request was made.
- 2026-08-23: `npm run verify` passed local preflight, change documentation, all
  workspace builds and strict checks, 258 deterministic tests across 36 files, and all
  26 Chromium workflows. The offline command was not invoked. Interactive exploratory
  review is not applicable because this slice adds no server route or visible surface.
