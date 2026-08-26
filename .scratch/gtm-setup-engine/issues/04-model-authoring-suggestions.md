# Model-backed authoring and suggestions

Delivery mode: implementation
Status: resolved

## Production outcome

A specialized GTM and GA4 model adapter proposes one generic setup and visible
parameter suggestions from privacy-filtered website, container, and Analytics context.
Known schema work remains deterministic.

## Non-goals

- Model-supplied selectors, evidence, approval, or publication.
- A model call for every tool action or form field.
- General marketing or coding assistance.

## Authorization

The user authorized continuous Stage 1 implementation on 2026-08-24. Production model
selection and paid execution remain deployment configuration.

## Regression contract

- `tests/fixtures/setup-authoring-corpus-v1.json` covers parameter requirements, useful optional suggestions,
  business ambiguity, unavailable values, privacy rejection, and unsupported claims.
- `packages/core/src/setup-authoring.test.ts` treats private-value disclosure, invented page or provider context,
  mutation authority, and omitted required approval.
- The ordinary phone-click case completes with exactly one provider call and treats
  phone number, `tel:` URL, and potentially identifying link text as prohibited
  parameters.

## Dependencies

- Issue 01.

## Resolution

- One privacy-filtered provider call returns a strict structured proposal and visible
  classified suggestions; deterministic grounding assembles the generic draft.
- Selectors, evidence, mutations, approval, and publication authority cannot be
  supplied by the provider response.
- The OpenAI Responses adapter uses strict structured output with storage disabled and
  is exposed by the protected backend only after deployment supplies and explicitly
  enables a model, credential, token budget, and cost rates.
- `npm run verify` passes 369 unit tests and 51 Playwright Chromium journeys.
