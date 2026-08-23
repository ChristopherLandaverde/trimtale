# Automate the canonical navigation-scope model corpus

Status: resolved

## Objective

Establish one provider-neutral set of canonical navigation-scope cases that protects
product behavior without coupling ordinary verification to a live model or exact prose.

## Regression contract

- `packages/core/src/navigation-scope-evaluation.test.ts` loads the committed corpus,
  validates every case and required coverage class, runs every case through the shared
  evaluator with a fixture provider, and proves wrong groups, authority violations,
  malformed results, provider errors, and timeouts cannot pass.
- `apps/api/src/run-navigation-scope-evaluation.test.ts` proves the smoke and full lanes
  consume the same corpus, select the intended cases, enforce per-case timeouts, emit a
  privacy-safe summary, and exit unsuccessfully when any selected case does not pass.
- The ordinary `npm test` gate remains deterministic and covers the complete corpus.
  `npm run evaluate:navigation:smoke` and `npm run evaluate:navigation:full` are explicit
  local-Ollama lanes; neither stores practitioner text or model prose.

## Positive case

A provider returns one allowed supplied group set with the required ambiguity state and
non-authoritative output; the case passes without comparing model-authored prose.

## Negative and inconclusive cases

An invented group, wrong group, authority escalation, malformed output, provider error,
or timeout produces a stable failed or inconclusive result and a non-zero command exit.

## Done when

- All canonical cases are automated in the normal deterministic gate.
- The smoke tier is a bounded subset and the full tier runs every canonical case through
  the production deterministic/provider routing boundary.
- A future provider adapter can use the corpus without changing expectations.

## Comments

- 2026-08-23: Claimed before implementation; the accepted design separates deterministic
  every-commit coverage from opt-in live-provider execution while keeping one corpus and
  one evaluator.
- 2026-08-23: Implemented 32 canonical cases with 16 coverage classes and six safety
  rules. The ordinary gate automates all cases. Live `qwen3:30b` smoke passed 15/15
  cases through 9 deterministic and 6 provider routes; the full lane passed 32/32
  through 20 deterministic and 12 provider routes. The evaluator accepts explicitly
  enumerated ambiguity sets but never exact model prose, and its output excludes source
  messages, prompts, raw responses, credentials, and clarification text. Built-extension
  exploration confirmed fuzzy, generic, adversarial, and provider-unavailable behavior.
