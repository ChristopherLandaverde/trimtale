# Add the intake evaluation report UI

> Historical change: this customer-facing surface was removed by issue 20 after
> product direction clarified that model evaluations are backend-only observability.

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/19-intake-evaluation-report-ui.md`

## Summary

The tracking assistant now has a focused read-only model-evaluation panel with strict
list/detail decoding, multi-report selection, provider evidence cards, safe non-pass
case rows, and explicit empty and unavailable states.

## Why

Practitioners need to see whether offline model candidates passed the accepted intake
corpus before any later suggestion experiment, without receiving an execution control
or confusing evaluation evidence with production authority.

## Behavior

The compact `Evals` control preserves the existing conversation and opens a keyboard-
focused panel. The newest report loads by default; a labeled selector loads older
reports. Provider cards show score, pass/fail/hard/inconclusive counts, p95 latency,
estimated cost, usage coverage, and safe case-level evidence.

The service worker can issue only GET requests to the fixed list route or an allowlisted
detail ID. Non-success bodies and transport details are discarded. Strict frontend
decoders reject unexpected fields, unsafe identifiers, malformed metrics, inconsistent
counts, and invalid case evidence. DOM rendering uses text properties only.

Empty and unavailable states expose no run action and say the panel cannot start a
model call. The visible boundary states that models cannot confirm specifications,
change GTM, or prove platform receipt. No credential, provider call, report write,
production intake influence, GTM mutation, or publication behavior is added.

## Regression coverage

`apps/extension/src/intake-evaluation-view.test.ts` protects strict list/detail
decoding, empty lists, all four provider display states, exact fields, safe IDs,
consistent outcomes and metrics, cross-provider case consistency, and adversarial
rejection.

`tests/e2e/intake-evaluation-ui.spec.ts` drives the built extension through keyboard
open/close, empty/no-run, conversation preservation, newest degraded evidence, older
passing selection, explicit authority language, unavailable retry, private-error
discard, attacker-shaped payload rejection, inert DOM, and three reviewed snapshots.

Six existing open-assistant, form-highlight, navigation-scope, evidence-path, and
managed-workspace baselines were intentionally regenerated after diff inspection because
the new visible `Evals` header control is present in every expanded assistant state.
The collapsed baseline is unchanged.

## Verification

Focused decoder coverage passed 10 tests, strict extension TypeScript checking and the
production extension build passed, and all 3 frontend Chromium journeys passed. After
the intentional baseline updates, `npm run verify` passed local preflight, change
documentation, every workspace build and strict check, all 274 deterministic tests
across 38 files, and all 30 Chromium workflows. No provider command, external request,
or paid model call ran.

## Exploratory review

[`docs/reviews/2026-08-23-intake-evaluation-report-ui.md`](../docs/reviews/2026-08-23-intake-evaluation-report-ui.md)
records empty, passing, degraded, inconclusive, unavailable, adversarial, keyboard,
focus, transcript, host-page, and visual review. Two medium presentation issues found
during review were fixed and baseline-protected. No blocker or high finding remains.

## Documentation

The accepted specification, engineering guide, current capabilities, issue 19, and
exploratory review document the view states, strict bridge/decoder boundary, visible
authority language, interaction behavior, and remaining production-model boundary.

The later backend-only boundary change removes the extension control, bridge, decoder,
and panel while retaining this record as implementation history.
