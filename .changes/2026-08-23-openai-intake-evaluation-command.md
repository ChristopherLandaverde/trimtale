# Add the owner-operated OpenAI intake evaluation command

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/17-openai-intake-evaluation-command.md`

## Summary

The backend now has a strict OpenAI Responses API shadow-provider adapter and an
owner-operated offline command for comparing two or three configured models over the
complete intake corpus.

## Why

Real model comparison needs an explicit credential and spend boundary before reports
can be exposed read-only to a frontend. Provider execution must remain off the public
server and outside deterministic verification.

## Behavior

The adapter sends only validated privacy-filtered intake input to the fixed official
HTTPS endpoint, requests strict structured output with `store: false` and no tools,
propagates harness aborts, caps response size, validates completed output and usage,
and estimates cost from explicit per-model rates. All provider failures are generic;
response bodies, keys, headers, and exception details are discarded.

The command preflights its credential-free configuration, model/provider uniqueness,
rates, timeout, output budget, workspace-confined paths, credential, corpus, and report
repository before execution. It prints one compact safe summary and persists only the
existing privacy-safe report. One explicit invocation makes 28 requests for two models
or 42 for three.

No key, model choice, price, automatic call, paid-call test, HTTP execution route,
extension consumer, practitioner workflow, GTM mutation, or publication behavior is
added.

## Regression coverage

`apps/api/src/openai-intake-provider.test.ts` protects the exact non-stored structured
request, supported schema subset, abort propagation, usage estimation, input preflight,
and generic handling of HTTP, transport, refusal, malformed, incomplete, missing, and
invalid-usage responses.

`apps/api/src/run-intake-evaluation.test.ts` protects strict credential-free config,
missing credential/config and unsafe-path preflight, no-call/no-write failures, a full
two-model 14-case comparison through injected fetch responses, private summary and
report output, owner-only persistence, and rejection of unvalidated input.

## Verification

Focused adapter and command coverage passed 31 tests, and API strict TypeScript
checking passed. `npm run verify` passed local preflight, change documentation, every
workspace build and strict check, all 258 deterministic tests across 36 files, and all
26 Chromium workflows. Verification used injected local responses and made no external
or paid provider request.

## Exploratory review

Not applicable. This is an offline backend command with no server route or visible
browser surface. No real provider call is made during verification.

## Documentation

The accepted conversational tracking specification, intake interpretation engineering
guide, current capabilities, and issue 17 document the adapter, command, privacy and
spend boundaries, operator configuration, and next read-only report slice.
