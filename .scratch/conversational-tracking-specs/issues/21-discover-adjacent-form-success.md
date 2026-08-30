# Discover an adjacent form success status

Status: resolved

## Objective

Prevent the assistant from sending a user to a diagnostic dead-end when a form's
nearest semantic section already contains one explicit, stable status/live region that
can be observed as success evidence.

## Regression contract

Required test level:

- Built production-extension journeys against the disposable verification target.
- Existing deterministic conversation, form-verdict, privacy, and Chromium suites.

Required positive case:

- A form without `data-success-selector` whose nearest `section`, `article`, or named
  region contains exactly one ID-addressable `role=status` or `aria-live` element is
  offered that element as a visible success signal.
- The live-equivalent disposable form advances to a reviewable `generate_lead` draft
  rather than saying it needs a diagnostic handoff.

Required negative cases:

- Zero candidates preserves the current diagnostic handoff.
- Multiple candidates remain ambiguous and preserve the diagnostic handoff.
- A candidate without a stable ID is ignored.
- Explicit `data-success-selector` and `data-success-url` signals retain precedence and
  existing behavior.

Required invariants:

- Discovery stays inside the form's nearest semantic section; it never searches the
  whole page or invents a selector.
- The discovered element is still proposed evidence subject to explicit specification
  review and confirmation; discovery does not prove submission, analytics receipt, or
  platform processing.
- Input values and status text do not enter evidence, generated artifacts, logs, or
  persistence.
- No credential, provider call, GTM write, or publication occurs.

## Work

- Add a narrowly scoped adjacent-status discovery helper to form scanning.
- Add live-equivalent positive and ambiguous/no-ID browser regressions.
- Review the headed ConsentFlow interaction and response copy.
- Update the contract and capability documentation.

## Done when

- The reported live-form dead-end becomes a reviewable draft.
- Ambiguous and unsafe candidates still fail closed.
- Focused and full repository gates pass.

## Comments

- 2026-08-23: Claimed from headed review on the live ConsentFlow form. The scanner
  found `#workflow-smoke-form` but ignored its adjacent `#workflow-smoke-success`
  `role=status` element because only manual dataset annotations were supported.
- 2026-08-23: The built-extension regression failed first on the exact diagnostic
  handoff, then passed for the live-equivalent unique status while multiple and ID-less
  status candidates continued to fail closed.
- 2026-08-23: Headed live review rendered the concise `generate_lead` interpretation
  and **Review setup** action without submitting the form.
- 2026-08-23: `npm run verify` passed local preflight, 35 change records, every build
  and strict check, 264 deterministic tests across 37 files, and 28 Chromium journeys.
  No credential, provider call, GTM write, form submission, or publication ran.
