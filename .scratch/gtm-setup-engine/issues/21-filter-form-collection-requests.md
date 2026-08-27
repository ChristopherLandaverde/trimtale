# Filter form collection requests by event

Delivery mode: implementation
Status: claimed

## Production outcome

Form run evidence classifies duplicate delivery from `generate_lead` requests only.
Other GA4 events observed during the same interaction cannot create a false duplicate
or satisfy the required lead-request evidence.

## Non-goals

- Changing the `generate_lead` event or required parameter contract.
- Treating browser evidence as GA4 platform confirmation.
- Generalizing request classification to other tracking intents.
- Changing Tag Assistant or publication behavior.

## Authorization

The user authorized these changes on 2026-08-26 after the credentialed live run
exposed the false duplicate verdict.

## Regression contract

- `packages/core/src/form-verdict.test.ts` proves one automatic `form_start` plus one
  complete `generate_lead` request passes browser verification.
- The same test proves a `form_start` request alone cannot pass browser verification.
- Existing verdict cases continue to prove two `generate_lead` requests are a
  duplicate and one incomplete `generate_lead` request is missing required evidence.

## Comments

- 2026-08-26: Regression first returned `duplicate_fire` for one `form_start` plus one
  `generate_lead` request. The accepted boundary is the event name carried by GA4's
  `en` query parameter.
