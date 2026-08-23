# Define the language-recognition contract

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/13-language-recognition-contract.md`

## Summary

The shared domain package now provides a versioned, runtime-validatable intake
interpretation contract and a 14-case privacy-filtered acceptance corpus.

## Why

Natural-language model behavior needs a stable, safety-bounded evaluation target before
any provider is connected to conversation intake or allowed to influence visible
workflow behavior.

## Behavior

Model-facing data is limited to bounded conversation messages, coarse page candidates,
grounded success-evidence candidates, and privacy metadata. Structured interpretations
must ground every candidate reference, ask only one bounded question when ambiguity
remains, and explicitly deny authority to confirm specifications, write GTM, report
evidence verdicts, or claim platform receipt.

This slice makes no model calls and adds no provider, prompt, credential, visible UI
change, GTM mutation, or publication behavior.

## Regression coverage

`packages/core/src/intake-interpretation.test.ts` validates the complete corpus and
proves that invented targets, evidence from an ungrounded target, selectors, page
payloads, verdict fields, unauthorized authority, invalid clarifications, and leaked
private sentinels fail closed.

## Verification

Focused intake interpretation coverage passed 6 tests, and the core workspace passed
strict TypeScript checking. `npm run verify` passed change-documentation and strict
TypeScript checks, every workspace build, all 211 deterministic tests across 31 files,
and all 26 Chromium workflows.

## Exploratory review

Not applicable. This is a provider-free domain contract and test corpus with no
user-visible or interactive browser behavior.

## Documentation

`CONTEXT.md` defines intake interpretation and the intake acceptance corpus. The
engineering contract documents the privacy and authority boundaries, while the current
capabilities and August 24 roadmap now identify the provider-neutral shadow harness as
the next implementation boundary.
