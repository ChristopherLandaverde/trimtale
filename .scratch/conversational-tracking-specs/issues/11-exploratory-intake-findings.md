# Remediate exploratory intake findings

Status: resolved

Blocked by: 03, 10

## Objective

Connect form clarification to visible page targets and make the GTM evidence stage report observed runtime state instead of generation history.

## Regression contract

Required test level: core/runtime unit tests plus Chromium E2E and reviewed visual baselines.

Behavioral tests:

- Form candidate and confirmed-target assertions in `tests/e2e/conversation-intake.spec.ts`.
- GTM runtime detection unit cases for present, absent, and inconclusive states.
- Evidence-path browser assertions that keep setup generation and runtime detection separate.

Required invariants:

- Every form offered as a clarification option has a corresponding candidate highlight.
- Selecting a form removes other candidate highlights and marks only the selected form confirmed.
- Highlights use stable form identity and never expose field values.
- GTM runtime detection reports `detected`, `not_detected`, or `inconclusive` with an observed public container ID only when safely available.
- A generated setup is not evidence that GTM is installed; detected GTM is not evidence that the generated setup was imported.
- No GTM state claims platform confirmation.

## Work

- Generalize page-target highlighting to navigation and form candidates.
- Return structured form identity with clarification actions.
- Inspect safe page/runtime signals for GTM presence without collecting container contents.
- Replace the ambiguous GTM evidence label with separate generation and runtime-observation language.
- Perform and document a new exploratory Chromium review.

## Done when

- Both findings in `docs/reviews/2026-08-22-conversation-intake.md` are resolved.
- Automated regressions cover highlights and GTM state semantics.
- Updated screenshots are intentionally reviewed.
- `npm run verify` passes.
- The follow-up exploratory review has no blocker/high findings.

## Comments

- 2026-08-22: Generalized safe page-target highlights to forms, added deterministic GTM runtime observation, separated generation/runtime/browser/platform evidence language, and reviewed candidate and confirmed visual baselines. Core runtime cases and four Chromium workflows pass with no remaining blocker/high exploratory findings.

## Answer

Form clarification now maps every assistant choice to a visible page highlight and retains only the selected form as confirmed. The evidence path reports observed GTM runtime state independently from setup generation, browser verification, and platform confirmation. Page-owned labels are inserted as text rather than executable markup.
