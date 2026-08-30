# Keep intake evaluations backend-only

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/20-keep-intake-evaluations-backend-only.md`

## Summary

The customer-facing tracking assistant no longer exposes model-evaluation reports.
The `Evals` control, overlay, frontend decoders, service-worker report bridge, report
fixtures, and report-specific browser journeys are removed. The owner-operated backend
evaluator, persisted reports, and protected read-only report API remain intact.

## Why

Model evaluation is internal observability and a release-quality gate, not a customer
workflow. Showing provider scores and harness failures in the assistant displaced the
conversation and implied a product capability that users should not need to understand.

## Behavior and safety

- The expanded assistant header contains only its existing collapse control.
- Chat, conversation state, target highlighting, evidence, downloads, GTM inspection,
  workspace preparation, and verification behavior are unchanged.
- The extension has no intake-report message type, report request, response decoder,
  provider card, or report state.
- Backend report routes remain read-only and cannot run a provider or write a report.
- Historical issue, change, and exploratory-review records are retained with an
  explicit superseded notice rather than rewritten as if the UI never existed.
- No credential, provider call, external model request, GTM write, or publication ran.

## Regression coverage

- The regression was first observed failing because Chromium found the visible model
  evaluation button.
- After removal, six focused conversation and navigation Chromium journeys passed.
- Six expanded-assistant baselines were regenerated; four match the pre-Evals blobs
  byte-for-byte and all six pass stable screenshot assertions.
- Full completion evidence is recorded in issue 20.

## Verification

`npm run verify` passed local preflight, 34 change records, every build and strict
check, 264 deterministic tests across 37 files, and all 27 Chromium journeys. The
exact-base documentation check and GitHub Verify workflow remain merge gates. No
credentialed or external provider command is part of those gates.

## Exploratory review

A headed production-extension session confirmed that the customer assistant contains
no evaluation control and that local chat begins rendering within a few milliseconds.
Review then moved to the live disposable GTM form and exposed a separate UX defect: the
form scanner does not yet discover its adjacent explicit status element. That discovery
behavior is intentionally handled as the next independent chat slice rather than mixed
into this product-boundary rollback.

## Documentation

The accepted specification, intake interpretation contract, current capabilities,
historical report-UI records, and issue 20 now state that evaluation reports are
backend-only operator observability and are not part of the customer assistant.

## Rollback

Revert this change only if product direction explicitly restores a customer-facing
model-evaluation report workflow. Backend evaluation requires no rollback.
