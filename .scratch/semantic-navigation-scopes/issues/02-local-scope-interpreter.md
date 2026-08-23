# Resolve navigation scope through a local provider-neutral interpreter

Status: resolved

## Objective

Use a configured loopback Ollama model to propose supplied navigation group IDs or one
clarification, with deterministic fallback and no mutation or confirmation authority.

## Regression contract

- Core contract tests reject invented group IDs, selector output, excess payloads,
  authority escalation, and unsafe labels.
- API tests cover valid structured Ollama output, timeout, refusal, malformed output,
  oversized responses, disabled configuration, and a fixed loopback endpoint.
- Service-worker and Chromium tests cover model suggestion, unavailable fallback, and
  unchanged practitioner confirmation.

## Done when

- The visible task can use a valid local suggestion without treating it as confirmed.
- Ollama failure leaves the same deterministic workflow usable.

## Comments

- 2026-08-23: Added the fixed-loopback `qwen3:30b` adapter, strict JSON schema,
  exact-origin API boundary, contradictory-output rejection, deterministic visible
  copy, and fast routing that skips the model for explicit or generic wording. Live
  synthetic fuzzy-language calls and the built-extension exploratory path passed; the
  model retained no confirmation, selector, GTM-write, or evidence authority.
