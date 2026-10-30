# Verdict copy should name a failed submission's conflicting success signal

Status: resolved

## Objective

Since issue 01, a run in which the form endpoint failed but the page still reported success gets
`submission_failed` or `expected_non_conversion`, with `outcome.observed: true`,
`interaction.responseStatus` and, often, a delivered `generate_lead` request in the evidence.
`verdict.nextAction` names the conflict, but the surrounding copy does not:

- `formExplanation` in `apps/extension/src/content-script.ts` says "The form was stopped by
  validation, so this attempt was not counted" for every `expected_non_conversion`, including an
  endpoint 422 after which a GA4 lead was sent.
- The verdict presenter on `feat/assistant-focosys-ux`
  (`apps/extension/src/verdict-presenter.ts`) says "The form's endpoint returned a server error
  after submit" and "nothing is sent to GA4" for `submission_failed`, and its validation branch
  says the browser's validation stopped the submission.

When `outcome.observed` is true on a failed submission, the finding should say the page reported
success, give the HTTP status, and, when `network.ga4Requests` is non-empty, say GA4 may count a
lead that does not exist. Evidence rows should include `interaction.responseStatus`.

Found in `docs/reviews/2026-10-30-server-error-precedence.md` (medium). Left for the presenter
work to avoid editing the assistant panel while it is being redesigned.

## Regression contract

- Presenter unit tests for `submission_failed` and `expected_non_conversion` with
  `outcome.observed: true`, with and without GA4 requests.
- `tests/e2e/form-real-signals.spec.ts`: the conflict scenarios already assert the HTTP status is
  visible; keep that assertion working against the new finding layout.

## Comments

- 2026-10-30: Resolved on `feat/assistant-focosys-ux` (#61). `apps/extension/src/verdict-presenter.ts`
  words `submission_failed` and `expected_non_conversion` from `outcome.observed`,
  `interaction.responseStatus` and `network.ga4Requests`. When the page showed success, the finding
  says "The page reported success, but the form endpoint returned HTTP <status>" (or "rejected the
  submission with HTTP <status>"). It adds "GA4 may count a lead that does not exist" when a
  request was sent, and evidence lists `interaction.responseStatus`. `formExplanation` no longer
  exists; the finding replaces it. Tests: the "endpoint failure while the page reported success"
  block in `apps/extension/src/verdict-presenter.test.ts`, and the conflict scenarios'
  `nextAction` checks in `tests/e2e/form-real-signals.spec.ts`, which now run against the finding.
