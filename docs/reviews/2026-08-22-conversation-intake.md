# Conversation intake exploratory review

Date: 2026-08-22

Build: `main` at `205aebb`

Environment: Playwright Chromium 1234 on Linux, unpacked extension from `apps/extension/dist`, local fixture site at `http://127.0.0.1:4173/`.

## Scenarios exercised

### Navigation scope

1. Opened the collapsed assistant.
2. Entered `Track the navigation links`.
3. Chose `Choose links`.
4. Confirmed the discovered navigation scope.

Observed: navigation candidates and confirmed targets were highlighted on the page. The assistant displayed its navigation evidence path.

### Ambiguous form intent

1. Entered `Track leads from a form`.
2. Chose `Contact sales` from two discovered forms.
3. Reviewed the proposed `generate_lead` specification.
4. Confirmed the specification.

Observed: target clarification, draft review, and explicit confirmation worked. Form candidates were not highlighted on the page before or after selection.

### GTM evidence state

Reviewed the evidence path on the local fixture page.

Observed: the GTM stage displayed `Not created from chat yet`. The product did not inspect or communicate whether a GTM runtime/container was actually present on the page, so generation state and observed installation state were conflated.

## Findings

### EXP-01 — Form candidates are not visually connected to the page

Severity: high

Expected: when the assistant asks which form represents the intended outcome, every candidate is visibly highlighted; after selection, only the confirmed form remains highlighted.

Observed: only navigation candidates have page highlights. Form selection occurs entirely inside the assistant.

Impact: a practitioner cannot confidently distinguish similarly named or visually separated forms, weakening the requirement that every included target be confirmed.

Remediation: `.scratch/conversational-tracking-specs/issues/11-exploratory-intake-findings.md`.

Resolution: fixed and reviewed in `2026-08-22-form-highlights-gtm-runtime.md`.

### EXP-02 — GTM evidence language does not report observed page state

Severity: high

Expected: the evidence path distinguishes setup generation from runtime observation and reports one of: GTM container detected with public ID, no GTM runtime detected, or detection inconclusive.

Observed: `Not created from chat yet` describes the assistant's generation history, not whether GTM is present on the inspected page.

Impact: the evidence path can mislead a practitioner about what the assistant inspected and cannot support later diagnosis.

Remediation: `.scratch/conversational-tracking-specs/issues/11-exploratory-intake-findings.md`.

Resolution: fixed and reviewed in `2026-08-22-form-highlights-gtm-runtime.md`.

## Review result

Result: remediation required.

The conversational intake mechanics work, but the user-visible slice should not be considered complete until both high-severity findings are fixed and protected by permanent regressions.
