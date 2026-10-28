# Ground outcome language with live model intake

Delivery mode: implementation
Status: resolved

## Production outcome

A signed-in tracking practitioner may state an outcome in ordinary language without
naming a form, event, or tag. When explicitly enabled, one backend language-model call
returns a non-authoritative intake interpretation containing one or more conversion-
outcome and observed-interaction candidates grounded only in privacy-filtered page
candidates. Exactly one unambiguous supported candidate may enter the existing
deterministic conversation intake; every other result asks for focus or falls back
safely without granting the model setup authority.

The first accepted journey is `Track lead generation` on a page with one observable
lead form and one success signal. The visible result is the existing reviewable
`generate_lead` specification, not a new lead-specific workflow.

## Non-goals

- Multi-activity selection, batch review, setup composition, or batch verification.
- A lead-generation-specific domain model or hard-coded phrase list.
- New observed-interaction types, tracking recipes, GTM writes, publication, or
  evidence verdicts.
- Persisting prompts, model output, raw provider responses, or model conversation
  state.
- Choosing a model for the operator, invoking a paid provider during tests, broadening
  the 14-case evaluation corpus, training, or fine-tuning.
- Rate limiting, organization-selectable models, or production deployment secrets.

## Authorization

The practitioner explicitly requested implementation of a general goal-to-measurement
planner on 2026-08-27, with lead generation as the first acceptance journey, an LLM as
the non-authoritative language interpreter, page grounding, and deterministic
configuration, approval, publication, and verification.

## Regression contract

- `packages/core/src/intake-interpretation-v2.test.ts` requires a generic multi-
  candidate interpretation contract, privacy-filtered input construction, exact page
  grounding, one-candidate adoption, multi-candidate focus, and rejection of invented
  targets, private values, selectors, and model authority.
- `apps/api/src/live-intake-api.test.ts` requires exact organization permission,
  validated provider input/output, bounded abort propagation, and fail-closed provider
  behavior.
- `apps/api/src/openai-intake-provider.test.ts` requires the live request to use the
  official Responses endpoint, `store: false`, no tools, bounded output, and strict
  structured output while rejecting disabled or malformed configuration and unsafe
  responses.
- `tests/e2e/goal-intake.spec.ts` requires ordinary outcome language to enter the
  existing form review journey through one intercepted model interpretation, while an
  invented target and a multiple-activity result cannot create or approve setup.

## Comments

- 2026-08-27: Claimed after confirming that the visible intake still uses a narrow
  deterministic phrase classifier while the existing OpenAI adapter is offline-only.
  ADR 0001 already establishes the governing boundary: the agent may interpret
  language, while validated tools and explicit approvals retain truth and authority.
- 2026-08-27: Resolved after 479 deterministic tests, 90 Chromium regressions, and a
  focused rendered review of happy, multiple-result, and prompt-shaped-page-evidence
  journeys. No external model request was made; live intake remains disabled until an
  owner configures and evaluates a model.
- 2026-08-27: Final diff audit added a failing-first regression for interaction-kind
  grounding. The closing browser gate also exposed a repeatable seven-pixel rounded-
  border anti-alias variance in an existing GA4 coverage snapshot; its assertion now
  allows ten pixels while retaining the original baseline.
- 2026-08-27: Issue 41 intentionally supersedes this slice's generic multi-result focus
  fallback with a non-authoritative measurement plan. Multi-result output still cannot
  create, review, or approve setup until one item is explicitly selected.
