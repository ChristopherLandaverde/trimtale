# Bring the in-page assistant up to the Focosys UX standard

Status: resolved

## Objective

Make every run verdict answer "what broke and what do I do next" in a few seconds, and put
the in-page assistant on the Focosys brand (DM Sans + IBM Plex Mono, paper/ink tokens).

Raised by the Slice 1 exploratory review (`docs/reviews/2026-10-30-form-real-signals.md`):
verdicts led with raw codes (`Verdict: submission_failed`), the fallback explanation
started lowercase (`submission failed. Fix the form…`), and the panel used an off-brand
dark glass theme. Christopher approved the change on 2026-10-30.

## Regression contract

Required test levels: unit (presenter copy) and Chromium E2E (rendered finding, fonts,
visual baselines).

- `apps/extension/src/verdict-presenter.test.ts`: every verdict code is worded as an
  outcome with observed → why → fix → verify; no copy contains the raw code, starts
  lowercase, uses blame words or exclamation marks, or exceeds 18 words per sentence;
  the evidence keeps `verdict.code`, `verdict.browserVerification` and
  `verdict.platformConfirmation`; a verified lead never claims platform confirmation;
  missing parameters and duplicate counts come from the evidence; attacker-shaped page
  labels stay bounded plain text.
- `tests/e2e/helpers/verdict.ts` (used by `conversational-form.spec.ts` and
  `form-real-signals.spec.ts`): the finding title is visible and is not a code; the four
  steps are visible; evidence is hidden until "Show evidence", which toggles
  `aria-expanded`; the evidence values match the deterministic verdict.
- `tests/e2e/navigation-extension.spec.ts`: the panel's computed font is the bundled
  `Trimtale DM Sans`, and the bundled sans and mono faces are loaded.
- Visual baselines in `navigation-extension`, `gtm-connection-context` and
  `conversation-intake` snapshots were replaced intentionally (darwin locally, Linux from CI).

## Comments

- 2026-10-30: Resolved by `feat/assistant-focosys-ux`. Fonts are inlined into the content
  script and registered with `FontFace` from bytes, so no remote font load, no
  `web_accessible_resources` entry, and no exposure to the page's `font-src` CSP.
