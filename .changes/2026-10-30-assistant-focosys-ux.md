# Assistant verdicts lead with the outcome, on Focosys tokens

Change record version: 2

Issue: `.scratch/conversational-tracking-specs/issues/23-assistant-focosys-ux.md`

## Summary

Run verdicts in the in-page assistant now render as findings that lead with the plain-language outcome and its consequence (observed → why → fix → verify), with the raw verdict code and observations one click away in mono. The panel and page highlights move to the Focosys tokens with DM Sans and IBM Plex Mono bundled in the extension.

## Why

The Slice 1 review found that verdicts led with raw codes (`Verdict: submission_failed`), the fallback explanation started lowercase, and the panel used an off-brand dark glass theme. A practitioner should know what broke and what to do next within a few seconds.

## Behavior

- New `apps/extension/src/verdict-presenter.ts` words every `ScenarioVerdictCode` for form and navigation runs. Missing parameters and duplicate counts come from the evidence. Page-sourced labels are bounded plain text.
- Copy for a failed or rejected submission reads `observations.outcome.observed`, `interaction.responseStatus` (added by #63; read defensively, so the copy works before and after #63 merges) and `network.ga4Requests`. When the page showed success over an endpoint failure, the finding says so with the HTTP status and warns about a phantom GA4 lead if one was sent. It never says nothing reached GA4 when a request was sent. This resolves #63's follow-up `.scratch/form-verdict-precedence/issues/02-presenter-conflict-copy.md`, which lives on #63's branch.
- `renderFinding()` in the content script replaces the two `Verdict: …` messages for interactive and post-publication runs. The evidence disclosure is a button with `aria-expanded`/`aria-controls`.
- `apps/extension/src/panel-styles.ts` holds the token stylesheet for the panel and the page highlights. The panel keeps content-box sizing so the settled-size preference is unchanged.
- `apps/extension/src/panel-fonts.ts` registers DM Sans (400/500/600) and IBM Plex Mono (400/500) from bytes inlined by esbuild's binary loader. No remote font load, no `web_accessible_resources`, no exposure to the page's `font-src` CSP. Licences ship in `dist/fonts/`.
- Unchanged: verdict logic, contracts, API, the setup-operation copy and publish flow, and `page-observer.ts`/signal capture.

## Regression coverage

- `apps/extension/src/verdict-presenter.test.ts` (23 tests; six cover the #63 conflict: 503 and 422 with and without a lead request, a 500 that still sent a lead, and browser-side validation with no status): each verdict code worded without the code, capitalised, no blame words, ≤ 18 words per sentence, evidence keeps the `verdict.*` fields; no platform-confirmation claim; exact missing parameters; duplicate count; hostile labels.
- `tests/e2e/helpers/verdict.ts`, used by `conversational-form.spec.ts`, `form-real-signals.spec.ts` and `page-signal-forgery.spec.ts` (from #60), replaces the `Verdict: <code>` text assertions: title visible and not a code, four steps visible, evidence hidden until toggled, evidence values match the deterministic verdict. The acceptance-fixture explanation scoring now reads the finding.
- `navigation-extension.spec.ts` asserts the computed font is `Trimtale DM Sans` (was `Inter`) and that the bundled faces load.
- `form-real-signals.spec.ts` now waits for the scenario's form before prompting. The `dynamic_form` fixture inserts its form 150ms after load; the faster panel exposed that the test could prompt before the form existed.
- `gtm-connection-context.spec.ts` and the navigation-scope screenshot move the pointer away before the matched-card screenshot: the refresh click re-renders the card under the pointer, so the new hover border made the baseline depend on hover timing.
- Visual baselines replaced intentionally: `assistant-collapsed`, `assistant-open`, `assistant-navigation-scope`, `assistant-evidence-path`, `assistant-managed-workspace`, `gtm-context-matched`, `gtm-context-offline`, `form-candidate-highlights`, `form-confirmed-highlight`. Darwin from local runs; Linux from the CI run's own captures.

## Verification

- `npm run check`: pass.
- `npx vitest run`: 42 files, 340 tests pass (rebased on #60).
- `npm run build`: pass.
- #63 compatibility: on a trial merge of this branch with `origin/fix/server-error-precedence`, `form-real-signals`, `form-fixtures`, `page-signal-forgery` and `conversational-form` passed 54/54. That includes #63's three conflict scenarios and their visible-next-action regex checks, which now match the finding's Observed line. The merge only conflicts in `form-real-signals.spec.ts`: keep `expectVerdictFinding(...)` plus #63's `if (item.nextAction) …` line.
- Playwright E2E (darwin): 71/71 after rebasing on #60. Two hover-dependent baselines (`gtm-context-matched`, `assistant-navigation-scope`) were fixed by moving the pointer away before the screenshot. Linux: CI.

## Exploratory review

`docs/reviews/2026-10-30-assistant-focosys-ux.md`: before/after for open, picker, evidence path, highlights and six verdicts, plus keyboard focus and a hostile label on a dark page. No blocker or high findings. The pre-existing setup-operation copy that leads with workflow codes is left for the publish-confirmation change.

## Documentation

Issue 23 added under `.scratch/conversational-tracking-specs/issues/`. Font licences bundled in `apps/extension/src/fonts/`.
